import { expect, test } from '@playwright/test'

test('two guests with a stale selection recover from conflict without losing fields', async ({
  page,
  browser,
}, testInfo) => {
  const title = '𐐀'.repeat(100)
  const guestName = '𐐀'.repeat(100)
  const guestEmail = `${'g'.repeat(64)}@${'e'.repeat(63)}.example.com`
  const topic = '<b>Обсудим проект</b>\n' + '𐐀'.repeat(470)
  const expectNoHorizontalOverflow = async () => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(testInfo.project.use.viewport!.width)
  }
  await page.goto('/owner/meeting-types')
  await page.getByLabel('Название').fill(title)
  await page.getByLabel('Описание').fill('Бронирование в настоящем календаре')
  await page.getByLabel('Длительность, минут').fill('20')
  await page.getByRole('button', { name: 'Создать тип встречи' }).click()
  const link = page.getByRole('link', { name: 'Публичная ссылка' })
  await expect(link).toBeVisible()
  const publicPath = await link.getAttribute('href')
  await link.click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expectNoHorizontalOverflow()
  const dayIndex = testInfo.project.name === 'desktop' ? 7 : 8
  await page
    .getByRole('group', { name: 'Выберите день' })
    .getByRole('button')
    .nth(dayIndex)
    .click()
  await page.getByRole('button', { name: '10:00–10:20' }).click()
  await expect(page.getByRole('status')).toContainText(title)
  await expectNoHorizontalOverflow()
  await page.getByLabel('Имя', { exact: true }).fill(guestName)
  await page.getByLabel('Email', { exact: true }).fill(guestEmail)
  await page.getByLabel('Тема разговора (необязательно)').fill('я'.repeat(501))
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(page.getByText('Введите не более 500 символов')).toBeVisible()
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue(guestName)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(
    guestEmail,
  )
  await expect(page.getByLabel('Тема разговора (необязательно)')).toHaveValue(
    'я'.repeat(501),
  )
  await page
    .getByLabel('Тема разговора (необязательно)')
    .fill('  ' + topic + '  ')

  const secondContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
  })
  const second = await secondContext.newPage()
  try {
    await second.goto(new URL(publicPath!, page.url()).href)
    await second
      .getByRole('group', { name: 'Выберите день' })
      .getByRole('button')
      .nth(dayIndex)
      .click()
    await second.getByRole('button', { name: '10:00–10:20' }).click()
    await second.getByLabel('Имя', { exact: true }).fill('Второй гость')
    await second.getByLabel('Email', { exact: true }).fill('Second@Example.com')
    await second
      .getByLabel('Тема разговора (необязательно)')
      .fill('Тема второго гостя')

    const posts: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/meetings')
      )
        posts.push(request.url())
    })
    await page.getByRole('button', { name: 'Подтвердить запись' }).click()
    await expect(
      page.getByRole('heading', { name: 'Встреча подтверждена' }),
    ).toBeVisible()
    await expect(page.getByText(guestName, { exact: true })).toBeVisible()
    await expect(page.getByText(guestEmail, { exact: true })).toBeVisible()
    await expect(
      page.getByText('Тема разговора: ' + topic, { exact: true }),
    ).toBeVisible()
    await expect(page.locator('b')).toHaveCount(0)
    await expectNoHorizontalOverflow()
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Встреча подтверждена' }),
    ).toBeVisible()
    await expect(
      page.getByText('Тема разговора: ' + topic, { exact: true }),
    ).toBeVisible()
    await expectNoHorizontalOverflow()
    expect(posts).toHaveLength(1)

    await second.getByRole('button', { name: 'Подтвердить запись' }).click()
    await expect(second.getByRole('alert')).toHaveText(
      'Это время уже занято. Выберите другое.',
    )
    await second
      .getByRole('group', { name: 'Выберите день' })
      .getByRole('button')
      .nth(dayIndex)
      .click()
    await expect(
      second.getByRole('button', { name: '10:00–10:20' }),
    ).toHaveCount(0)
    await second.getByRole('button', { name: '11:00–11:20' }).click()
    await expect(second.getByLabel('Имя', { exact: true })).toHaveValue(
      'Второй гость',
    )
    await expect(second.getByLabel('Email', { exact: true })).toHaveValue(
      'Second@Example.com',
    )
    await expect(
      second.getByLabel('Тема разговора (необязательно)'),
    ).toHaveValue('Тема второго гостя')
    await second.getByRole('button', { name: 'Подтвердить запись' }).click()
    await expect(
      second.getByRole('heading', { name: 'Встреча подтверждена' }),
    ).toBeVisible()
    await expect(
      second.getByText('Тема разговора: Тема второго гостя', { exact: true }),
    ).toBeVisible()
    expect(
      await second.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  } finally {
    await secondContext.close()
  }
})

test('an older browser draft can book without a topic and restore its confirmation', async ({
  page,
}, testInfo) => {
  const id = '00000000-0000-0000-0000-000000000001'
  await page.goto('/meetings')
  await page.evaluate(
    (id) =>
      sessionStorage.setItem(
        `booking:${id}`,
        JSON.stringify({
          name: 'Прежний гость',
          email: 'legacy@example.com',
          state: 'draft',
        }),
      ),
    id,
  )
  await page.goto(`/meetings/${id}`)
  await page
    .getByRole('group', { name: 'Выберите день' })
    .getByRole('button')
    .nth(testInfo.project.name === 'desktop' ? 10 : 11)
    .click()
  await page.getByRole('button', { name: '14:00–14:20' }).click()
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue(
    'Прежний гость',
  )
  await expect(page.getByLabel('Тема разговора (необязательно)')).toHaveValue(
    '',
  )
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(
    page.getByRole('heading', { name: 'Встреча подтверждена' }),
  ).toBeVisible()
  await expect(page.getByText('Тема разговора:', { exact: false })).toHaveCount(
    0,
  )
  // Confirmation data saved by the previous SDK also has no topic.
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Встреча подтверждена' }),
  ).toBeVisible()
  await expect(page.getByText('Прежний гость', { exact: true })).toBeVisible()
  await expect(page.getByText('Тема разговора:', { exact: false })).toHaveCount(
    0,
  )
})
