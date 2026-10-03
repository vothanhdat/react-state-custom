import { describe } from 'vitest'
import { updateBench } from './harness'
import { CONSUMERS, shopAdapters, type ShopUpdate } from './shop'

const scenario = (kind: ShopUpdate, title: string) =>
  describe(`shop: config -> items -> lines -> checkouts -> summary, ${CONSUMERS} consumers: ${title}`, () => {
    for (const a of shopAdapters) updateBench(a.name, a.create, CONSUMERS, CONSUMERS, (w, tick) => w.update(kind, tick))
  })

scenario('qty', 'change the qty of one item (1 line, 1 checkout, summary: 235 consumers)')
scenario('vat', 'change vat (every checkout and the summary: 500 consumers)')
scenario('theme', 'change theme (nothing derived reads it)')
scenario('discount', 'change discount (everything: 1000 consumers)')
