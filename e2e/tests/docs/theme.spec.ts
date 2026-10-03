import { expect, test } from '@playwright/test';

// Яркость цвета из computed style `rgb(r, g, b)` / `rgba(r, g, b, a)`: 0 — чёрный, 255 — белый.
const brightness = (color: string) => {
  const [r, g, b] = color.match(/[\d.]+/g)!.map(Number);
  return Math.min(r, g, b);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`системная тема: ${colorScheme}`, () => {
    test.use({ colorScheme });

    test('документация остаётся светлой и строгой', async ({ page }) => {
      await page.goto('/docs/index.html');
      const style = (selector: string, property: string) =>
        page.locator(selector).first().evaluate(
          (element, name) => getComputedStyle(element).getPropertyValue(name), property);

      expect(brightness(await style('body', 'background-color'))).toBeGreaterThanOrEqual(240);
      expect(brightness(await style('main.content', 'background-color'))).toBeGreaterThanOrEqual(240);
      expect(brightness(await style('aside.sidebar', 'background-color'))).toBeGreaterThanOrEqual(240);
      expect(brightness(await style('body', 'color'))).toBeLessThanOrEqual(80);
      expect(await style('html', 'color-scheme')).toBe('light');
      // Заголовки — обычный текст без плашек-фонов.
      for (const heading of ['.chapter > h2', '.sub-chapter h3']) {
        expect(await style(heading, 'background-color')).toBe('rgba(0, 0, 0, 0)');
      }
    });

    test('якоря содержания ведут к разделам', async ({ page }) => {
      await page.goto('/docs/index.html');
      await page.getByRole('link', { name: 'Содержание и часы' }).click();
      await expect(page).toHaveURL(/#hours$/);
      await expect(page.locator('#hours')).toBeInViewport();

      const header = page.getByRole('button', { name: 'Администратор' });
      await header.click();
      await expect(header).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('link', { name: 'Пользователи' })).toBeHidden();
    });
  });
}
