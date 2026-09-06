import { beforeEach, describe, expect, it } from 'vitest';
import type { OtpChallenge } from '../src/domain/otp.ts';
import {
  AuthenticateByPhone,
  AuthentificationRefuseeError,
  TropDeDemandesError,
} from '../src/application/authenticate-by-phone.ts';
import type {
  AnnuaireComptes,
  ApiTokenIssuer,
  OtpChallengeRepository,
  OtpSender,
} from '../src/ports/authentication.ts';

class Challenges implements OtpChallengeRepository {
  readonly tous: OtpChallenge[] = [];
  async trouverVivant(msisdn: string) {
    return this.tous.find((c) => c.msisdn === msisdn && !c.consomme) ?? null;
  }
  async remplacer(c: OtpChallenge) {
    for (let i = 0; i < this.tous.length; i += 1) {
      if (this.tous[i].msisdn === c.msisdn && !this.tous[i].consomme) {
        this.tous[i] = { ...this.tous[i], consomme: true };
      }
    }
    this.tous.push(c);
  }
  async majTentative(c: OtpChallenge) {
    const i = this.tous.findIndex((x) => x.id === c.id);
    if (i >= 0) this.tous[i] = c;
  }
  async compterDepuis(msisdn: string, depuis: string) {
    return this.tous.filter((c) => c.msisdn === msisdn && c.emisA >= depuis).length;
  }
}

class Envois implements OtpSender {
  readonly envoyes: { msisdn: string; code: string }[] = [];
  async envoyer(msisdn: string, code: string) {
    this.envoyes.push({ msisdn, code });
    return true;
  }
}

const ANNUAIRE: AnnuaireComptes = {
  async resoudre(msisdn) {
    if (msisdn === '+221770000001') {
      return { subject: 'chauffeur-7', role: 'DRIVER', stationId: null };
    }
    if (msisdn === '+221770000002') {
      return { subject: 'pompiste-12', role: 'STATION_OPERATOR', stationId: 'station-3' };
    }
    return null;
  },
};

class Jetons implements ApiTokenIssuer {
  readonly emis: { subject: string; expireA: string }[] = [];
  async emettre(input: { subject: string; expireA: string }) {
    this.emis.push({ subject: input.subject, expireA: input.expireA });
    return `jeton-${this.emis.length}`;
  }
}

const MAINTENANT = '2026-09-06T12:00:00.000Z';

function compteur() {
  let n = 0;
  return { next: () => `chal-${(n += 1)}` };
}

let challenges: Challenges;
let envois: Envois;
let jetons: Jetons;
let auth: AuthenticateByPhone;

beforeEach(() => {
  challenges = new Challenges();
  envois = new Envois();
  jetons = new Jetons();
  auth = new AuthenticateByPhone({
    challenges,
    sender: envois,
    annuaire: ANNUAIRE,
    jetons,
    ids: compteur(),
    otp: { dureeSecondes: 300, maxTentatives: 5, maxDemandesParHeure: 3, echoCode: false },
    sessionDureeHeures: 12,
  });
});

describe('demande de code', () => {
  it('envoie un code à un numéro connu', async () => {
    const r = await auth.demanderCode('77 000 00 01', MAINTENANT);
    expect(r.valideSecondes).toBe(300);
    expect(envois.envoyes).toHaveLength(1);
    expect(envois.envoyes[0].msisdn).toBe('+221770000001');
    expect(envois.envoyes[0].code).toMatch(/^\d{6}$/);
  });

  it('répond exactement pareil pour un numéro inconnu, sans rien envoyer', async () => {
    const connu = await auth.demanderCode('770000001', MAINTENANT);
    const inconnu = await auth.demanderCode('770009999', MAINTENANT);

    // L'écran de connexion ne doit pas dire qui est client.
    expect(inconnu).toEqual(connu);
    expect(envois.envoyes.filter((e) => e.msisdn === '+221770009999')).toHaveLength(0);
  });

  it('ne renvoie jamais le code par défaut', async () => {
    const r = await auth.demanderCode('770000001', MAINTENANT);
    expect(r.code).toBeUndefined();
  });

  it('renvoie le code seulement si l’écho est explicitement activé', async () => {
    const avecEcho = new AuthenticateByPhone({
      challenges,
      sender: envois,
      annuaire: ANNUAIRE,
      jetons,
      ids: compteur(),
      otp: { dureeSecondes: 300, maxTentatives: 5, maxDemandesParHeure: 3, echoCode: true },
      sessionDureeHeures: 12,
    });
    const r = await avecEcho.demanderCode('770000001', MAINTENANT);
    expect(r.code).toMatch(/^\d{6}$/);
  });

  it('limite le nombre de demandes par heure', async () => {
    for (let n = 0; n < 3; n += 1) await auth.demanderCode('770000001', MAINTENANT);
    await expect(auth.demanderCode('770000001', MAINTENANT)).rejects.toThrow(TropDeDemandesError);
  });

  it('une nouvelle demande invalide le code précédent', async () => {
    await auth.demanderCode('770000001', MAINTENANT);
    const ancien = envois.envoyes[0].code;
    await auth.demanderCode('770000001', MAINTENANT);

    await expect(auth.ouvrirSession('770000001', ancien, MAINTENANT)).rejects.toThrow(
      AuthentificationRefuseeError,
    );
  });

  it('refuse un numéro inexploitable', async () => {
    await expect(auth.demanderCode('abc', MAINTENANT)).rejects.toThrow(/inexploitable/);
  });
});

describe('ouverture de session', () => {
  async function codeValide(numero = '770000001'): Promise<string> {
    await auth.demanderCode(numero, MAINTENANT);
    return envois.envoyes.at(-1)!.code;
  }

  it('accorde une session au bon code', async () => {
    const code = await codeValide();
    const session = await auth.ouvrirSession('770000001', code, MAINTENANT);

    expect(session).toMatchObject({ role: 'DRIVER', subject: 'chauffeur-7', stationId: null });
    expect(session.token).toBe('jeton-1');
    expect(session.expireA).toBe('2026-09-07T00:00:00.000Z');
  });

  it('accorde le rôle et la station du pompiste', async () => {
    const code = await codeValide('770000002');
    const session = await auth.ouvrirSession('770000002', code, MAINTENANT);
    expect(session).toMatchObject({ role: 'STATION_OPERATOR', stationId: 'station-3' });
  });

  it('refuse un code faux et fait avancer le compteur', async () => {
    await codeValide();
    await expect(auth.ouvrirSession('770000001', '000000', MAINTENANT)).rejects.toThrow(
      AuthentificationRefuseeError,
    );
    expect((await challenges.trouverVivant('+221770000001'))?.tentatives).toBe(1);
  });

  it('bloque après cinq codes faux, même si le bon arrive ensuite', async () => {
    const code = await codeValide();
    for (let n = 0; n < 5; n += 1) {
      await auth.ouvrirSession('770000001', '000000', MAINTENANT).catch(() => undefined);
    }
    await expect(auth.ouvrirSession('770000001', code, MAINTENANT)).rejects.toThrow(/épuisé/);
  });

  it('refuse un code expiré', async () => {
    const code = await codeValide();
    await expect(
      auth.ouvrirSession('770000001', code, '2026-09-06T12:05:01.000Z'),
    ).rejects.toThrow(/expiré/);
  });

  it('un code ne sert qu’une fois', async () => {
    const code = await codeValide();
    await auth.ouvrirSession('770000001', code, MAINTENANT);
    await expect(auth.ouvrirSession('770000001', code, MAINTENANT)).rejects.toThrow(
      AuthentificationRefuseeError,
    );
  });

  it('refuse quand aucun code n’a été demandé', async () => {
    await expect(auth.ouvrirSession('770000001', '123456', MAINTENANT)).rejects.toThrow(
      /aucun code en cours/,
    );
  });

  it('aucun message d’erreur ne contient le code attendu', async () => {
    const code = await codeValide();
    try {
      await auth.ouvrirSession('770000001', '000000', MAINTENANT);
    } catch (e) {
      expect((e as Error).message).not.toContain(code);
    }
  });
});
