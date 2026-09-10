/**
 * Normalisation des numéros de téléphone.
 *
 * Un numéro est une identité : c'est lui qui décide qui reçoit un code, donc qui entre. Deux
 * saisies du même numéro doivent produire la même chaîne, sinon un chauffeur se retrouve avec
 * deux comptes ; et deux numéros différents ne doivent jamais converger, sinon l'un reçoit les
 * bons de l'autre.
 *
 * Le service couvre le Sénégal et la Côte d'Ivoire. Les deux plans sont distinguables sans
 * ambiguïté — 9 chiffres commençant par 7 au Sénégal, 10 chiffres commençant par 0 en Côte
 * d'Ivoire — ce qui permet d'accepter une saisie locale sans demander l'indicatif.
 *
 * On refuse les fixes. Le système ne parle à un chauffeur que par SMS : accepter un numéro qui
 * ne peut pas en recevoir, c'est lui promettre un code qui n'arrivera jamais.
 */

import { describe, expect, it } from 'vitest';
import { MsisdnInvalideError, normaliserMsisdn } from '../src/domain/otp.ts';
// @ts-expect-error — module JavaScript sans types, importé exprès pour confronter les deux.
import { normaliserMsisdn as normaliserPourScripts } from '../scripts/msisdn.mjs';

describe('Sénégal', () => {
  it('complète un mobile local à neuf chiffres', () => {
    expect(normaliserMsisdn('770000001')).toBe('+221770000001');
  });

  it('accepte les cinq préfixes mobiles ouverts', () => {
    // 70 Expresso/Orange, 75 et 76 Free, 77 et 78 Orange.
    for (const prefixe of ['70', '75', '76', '77', '78']) {
      expect(normaliserMsisdn(`${prefixe}0000001`)).toBe(`+221${prefixe}0000001`);
    }
  });

  it('ignore espaces, points et tirets', () => {
    // Un chauffeur tape ce qu'il lit sur sa carte SIM.
    for (const saisie of ['77 000 00 01', '77.000.00.01', '77-000-00-01', '(77) 000 00 01']) {
      expect(normaliserMsisdn(saisie)).toBe('+221770000001');
    }
  });

  it('accepte la forme internationale, avec + ou 00', () => {
    for (const saisie of ['+221770000001', '00221770000001', '221770000001']) {
      expect(normaliserMsisdn(saisie)).toBe('+221770000001');
    }
  });

  it('refuse un fixe', () => {
    // 33 est le fixe sénégalais : il ne recevra jamais de SMS.
    expect(() => normaliserMsisdn('338000001')).toThrow(MsisdnInvalideError);
  });

  it('refuse un numéro trop court ou trop long', () => {
    expect(() => normaliserMsisdn('77000000')).toThrow(MsisdnInvalideError);
    expect(() => normaliserMsisdn('7700000012')).toThrow(MsisdnInvalideError);
  });
});

describe('Côte d’Ivoire', () => {
  it('complète un mobile local à dix chiffres', () => {
    expect(normaliserMsisdn('0700000001')).toBe('+2250700000001');
  });

  it('accepte les trois préfixes mobiles', () => {
    // 01 Moov, 05 MTN, 07 Orange, depuis le passage à dix chiffres en 2021.
    for (const prefixe of ['01', '05', '07']) {
      expect(normaliserMsisdn(`${prefixe}00000001`)).toBe(`+225${prefixe}00000001`);
    }
  });

  it('accepte la forme internationale', () => {
    for (const saisie of ['+2250700000001', '002250700000001', '2250700000001']) {
      expect(normaliserMsisdn(saisie)).toBe('+2250700000001');
    }
  });

  it('refuse un fixe', () => {
    // 21, 25 et 27 sont les fixes ivoiriens.
    for (const prefixe of ['21', '25', '27']) {
      expect(() => normaliserMsisdn(`${prefixe}00000001`)).toThrow(MsisdnInvalideError);
    }
  });

  it('refuse un numéro à huit chiffres, format d’avant 2021', () => {
    // Le plan est passé de 8 à 10 chiffres le 31 janvier 2021. Un ancien numéro ne joint plus
    // personne : mieux vaut le refuser que composer un numéro mort.
    expect(() => normaliserMsisdn('07000001')).toThrow(MsisdnInvalideError);
  });
});

describe('ce qui ne doit jamais passer', () => {
  it('refuse un pays non couvert', () => {
    // +33 France. Le service ne le dessert pas, et l'accepter enverrait des codes dans le vide.
    expect(() => normaliserMsisdn('+33612345678')).toThrow(MsisdnInvalideError);
  });

  it('refuse une saisie vide ou non numérique', () => {
    for (const saisie of ['', '   ', 'abcdefghi', '+++']) {
      expect(() => normaliserMsisdn(saisie)).toThrow(MsisdnInvalideError);
    }
  });

  it('ne laisse jamais deux numéros différents converger', () => {
    // La garantie qui compte : un chauffeur ne doit pas recevoir les bons d'un autre.
    const formes = ['770000001', '760000001', '0700000001', '0100000001'];
    const normalises = formes.map((f) => normaliserMsisdn(f));

    expect(new Set(normalises).size).toBe(formes.length);
  });

  it('rend la même chaîne quelle que soit la façon d’écrire le même numéro', () => {
    // L'autre moitié de la garantie : un chauffeur ne doit pas se retrouver avec deux comptes.
    const memes = ['77 000 00 01', '+221 77 000 00 01', '00221770000001', '221770000001'];

    expect(new Set(memes.map((m) => normaliserMsisdn(m))).size).toBe(1);
  });
});

describe('la frontière entre les deux plans', () => {
  it('9 chiffres commençant par 7 est sénégalais, jamais ivoirien', () => {
    expect(normaliserMsisdn('770000001').startsWith('+221')).toBe(true);
  });

  it('10 chiffres commençant par 0 est ivoirien, jamais sénégalais', () => {
    // Le plan sénégalais ne comporte aucun préfixe national 0 : un 0 en tête ne peut donc pas
    // venir du Sénégal.
    expect(normaliserMsisdn('0700000001').startsWith('+225')).toBe(true);
  });
});

describe('le domaine et les scripts sont d’accord', () => {
  it('rendent le même résultat sur toute la batterie', () => {
    // Les scripts d'amorçage tournent avant toute compilation : ils ne peuvent pas importer le
    // domaine, et portent donc leur propre copie. Ce test est ce qui garde la copie honnête.
    // Un administrateur amorcé sous une forme et reconnu sous une autre ne pourrait plus se
    // connecter — et personne ne comprendrait pourquoi.
    const batterie = [
      '770000001',
      '78 000 00 01',
      '+221760000001',
      '00221750000001',
      '0700000001',
      '0100000001',
      '+2250500000001',
      '338000001',
      '2100000001',
      '07000001',
      '+33612345678',
      'abcdefghi',
      '',
    ];

    for (const saisie of batterie) {
      let duDomaine: string | null = null;
      try {
        duDomaine = normaliserMsisdn(saisie);
      } catch {
        duDomaine = null;
      }
      expect(normaliserPourScripts(saisie), `désaccord sur « ${saisie} »`).toBe(duDomaine);
    }
  });
});
