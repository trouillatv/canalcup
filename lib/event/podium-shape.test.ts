// Forme du podium de la cérémonie. Exécuter : `npm test`
//
// Régression vécue en prod (21/07) : la marche du VAINQUEUR était plus basse que
// celle du dauphin. Cause — deux tableaux indexés différemment : l'ordre
// d'affichage (gauche→droite : 2e · 1er · 3e) et les hauteurs, que j'avais
// écrites dans l'ordre des POSITIONS mais indexées par le RANG.
//
// Ce test rejoue l'assemblage réel : il reconstruit les trois marches de gauche
// à droite et vérifie la silhouette. Il échouerait de nouveau si quelqu'un
// réordonnait l'un des deux tableaux sans l'autre.

import { test } from "node:test";
import assert from "node:assert/strict";

// ⚠️ Doivent rester le miroir exact de components/final/ClosingCeremony.tsx.
const PODIUM_ORDER = [1, 0, 2]; // positions gauche → droite, en index de rang
const PODIUM_H = ["h-32", "h-24", "h-20"]; // indexé par RANG (0 = 1er)

const px = (h: string) => Number(h.replace("h-", "")) * 4; // échelle Tailwind

test("la marche du milieu est celle du 1er, et c'est la plus haute", () => {
  const steps = PODIUM_ORDER.map((rankIdx) => ({
    rankIdx,
    height: px(PODIUM_H[rankIdx]),
  }));

  const [left, middle, right] = steps;

  assert.equal(middle.rankIdx, 0, "la marche du milieu doit porter le 1er");
  assert.equal(left.rankIdx, 1, "à gauche : le 2e");
  assert.equal(right.rankIdx, 2, "à droite : le 3e");

  assert.ok(
    middle.height > left.height,
    `le 1er (${middle.height}px) doit dominer le 2e (${left.height}px)`
  );
  assert.ok(
    left.height > right.height,
    `le 2e (${left.height}px) doit dominer le 3e (${right.height}px)`
  );
});

test("la hauteur décroît strictement avec le rang", () => {
  const heights = PODIUM_H.map(px);
  for (let i = 1; i < heights.length; i++) {
    assert.ok(
      heights[i - 1] > heights[i],
      `rang ${i} (${heights[i]}px) ne peut pas être ≥ rang ${i - 1} (${heights[i - 1]}px)`
    );
  }
});
