# Bitrix24 Integration Configuration

## Настройка конфигурации

Перед использованием интеграции необходимо настроить файл `config.js` с реальными ID из вашего Bitrix24.

### 1. Category ID (Воронка сделок)

Установите `CATEGORY_ID` - это ID воронки, в которой будут создаваться сделки.

**Как найти:**
1. В Bitrix24 перейдите в CRM → Сделки
2. Выберите нужную воронку
3. ID воронки можно увидеть в URL или через API `crm.dealcategory.list`

### 2. Stage IDs (Стадии сделок)

Заполните массив `STAGES` с ID стадий для разных статусов оплаты:

- `PAID` - стадия для оплаченных заказов
- `PENDING` - стадия для заказов, ожидающих оплаты
- `REFUNDED` - стадия для возвращенных заказов
- `CANCELLED` - стадия для отмененных заказов
- `DEFAULT` - стадия по умолчанию (если статус не определен)

**Как найти:**
1. В Bitrix24 перейдите в CRM → Сделки → Настройки воронки
2. ID стадии можно увидеть в URL или через API `crm.dealcategory.stage.list`

### 3. Source IDs (Источники)

Заполните массив `SOURCES` с ID источников:

- `SHOPIFY_DRAFT_ORDER` - для заказов из черновиков Shopify
- `SHOPIFY` - для обычных заказов из Shopify

**Как найти:**
1. В Bitrix24 перейдите в CRM → Настройки → Источники
2. ID источника можно увидеть в URL или через API `crm.status.list`

### 4. Product IDs (Товары)

Заполните объект `SKU_TO_PRODUCT_ID` с маппингом SKU из Shopify на Product ID в Bitrix24:

```javascript
SKU_TO_PRODUCT_ID: {
  'ALB0002': 123, // Product ID в Bitrix24 для SKU ALB0002
  'ALB0005': 124, // Product ID в Bitrix24 для SKU ALB0005
  // Добавьте больше маппингов по мере необходимости
}
```

**Как найти:**
1. В Bitrix24 перейдите в CRM → Товары
2. Откройте нужный товар
3. ID товара можно увидеть в URL или через API `crm.product.list`

### 5. Shipping Product ID (Доставка)

Если вы хотите добавлять доставку как отдельную строку товара, установите `SHIPPING_PRODUCT_ID` на ID товара "Доставка" в Bitrix24.

Если не нужно добавлять доставку как товар, оставьте `0`.

## Webhook URL

По умолчанию используется webhook URL: `https://bfcshoes.bitrix24.eu/rest/52/i6l05o71ywxb8j1l/`

Вы можете переопределить его через переменную окружения `BITRIX_WEBHOOK_URL`.

## Пример конфигурации

```javascript
export const BITRIX_CONFIG = {
  CATEGORY_ID: 42, // ID воронки
  
  STAGES: {
    PAID: 'C42:WON',      // Стадия "Успешно реализовано"
    PENDING: 'C42:PREPARATION', // Стадия "Подготовка"
    REFUNDED: 'C42:LOSE', // Стадия "Проиграно"
    CANCELLED: 'C42:LOSE',
    DEFAULT: 'C42:PREPARATION'
  },
  
  SOURCES: {
    SHOPIFY_DRAFT_ORDER: 'SHOPIFY_DRAFT',
    SHOPIFY: 'SHOPIFY'
  },
  
  SHIPPING_PRODUCT_ID: 999, // ID товара "Доставка"
  
  SKU_TO_PRODUCT_ID: {
    'ALB0002': 123,
    'ALB0005': 124
  }
};
```

## Тестирование

После настройки конфигурации создайте тестовый заказ в Shopify с товарами, имеющими SKU из вашего маппинга. Заказ должен автоматически:

1. Создать/найти контакт по email
2. Создать сделку в Bitrix24
3. Добавить товары в сделку
4. Установить правильную стадию и источник

