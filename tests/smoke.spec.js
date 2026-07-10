import { test, expect } from '@playwright/test';

/* Smoke tests Urbe Studio — filet minimal sur le parcours d'encaissement.
   Si l'un de ces tests casse, on ne déploie pas : ils couvrent les 3 pages
   par lesquelles passe l'argent (home → tarifs → tunnel de réservation). */

test('home : la page charge sans erreur JS et le CTA principal est là', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/URBE/i);
  await expect(page.getByRole('button', { name: /Réserver une session/i }).first()).toBeVisible();
  expect(errors, `Erreurs JS sur la home :\n${errors.join('\n')}`).toHaveLength(0);
});

test('tarifs : les prix affichés correspondent au catalogue (garde-fou régression prix)', async ({ page }) => {
  await page.goto('/tarifs');
  // rec-1h : la séance découverte est à 70€ pour 2h — a régressé à 30€ par le
  // passé (bug corrigé le 08/07), ce test empêche que ça revienne.
  await expect(page.getByText('Découverte 2h').first()).toBeVisible();
  await expect(page.getByText('70€ · 2h').first()).toBeVisible();
  // Mixage standard : 120€/titre, prix pivot de l'offre mix.
  await expect(page.getByText('120€/titre').first()).toBeVisible();
});

test('réservation : le tunnel se charge et propose le catalogue', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/reservation');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/RÉSERVER UNE SESSION/i);
  // Au moins un produit du catalogue est proposé à la sélection.
  await expect(page.getByText('Découverte 2h').first()).toBeVisible();
  expect(errors, `Erreurs JS sur le tunnel :\n${errors.join('\n')}`).toHaveLength(0);
});
