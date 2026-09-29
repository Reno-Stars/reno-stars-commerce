import {
  Button,
  Checkbox,
  Drawer,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ReactNode, useEffect, useState } from "react"
import { sdk } from "../../lib/client"

export type PriceMeta = {
  unit?: string | null
  source?: string | null
  effective?: string | null
  pdf_name?: string | null
  pdf_sku?: string | null
  sf_per_box?: number | null
  markup_applied?: number | null
}

export type SupplyInfoFormInitial = {
  our_sku: string | null
  importer_sku: string | null
  supplier_name: string | null
  notes: string | null
  import_price_amount: number | null
  size: string | null
  meta: PriceMeta
  sell_cad: number | null
}

const UNITS = [
  { value: "per_sf", label: "per sq ft" },
  { value: "per_pc", label: "per piece" },
  { value: "per_box", label: "per box" },
  { value: "per_roll", label: "per roll" },
  { value: "per_set", label: "per set" },
]

const DEFAULT_MARKUP = 1.6

// "" -> null so a cleared field is saved as cleared, not as an empty string.
const textOrNull = (v: string) => (v.trim() === "" ? null : v.trim())
const numOrNull = (v: string) => {
  if (v.trim() === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const round2 = (n: number) => Math.round(n * 100) / 100
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v))

type FormState = Record<
  | "our_sku" | "importer_sku" | "supplier_name" | "notes" | "buy" | "size"
  | "unit" | "source" | "effective" | "pdf_name" | "pdf_sku" | "sf_per_box"
  | "markup" | "sell",
  string
>

const toForm = (i: SupplyInfoFormInitial): FormState => ({
  our_sku: str(i.our_sku),
  importer_sku: str(i.importer_sku),
  supplier_name: str(i.supplier_name),
  notes: str(i.notes),
  buy: str(i.import_price_amount),
  size: str(i.size),
  unit: str(i.meta.unit) || "per_sf",
  source: str(i.meta.source),
  effective: str(i.meta.effective),
  pdf_name: str(i.meta.pdf_name),
  pdf_sku: str(i.meta.pdf_sku),
  sf_per_box: str(i.meta.sf_per_box),
  markup: str(i.meta.markup_applied ?? DEFAULT_MARKUP),
  sell: str(i.sell_cad),
})

const Field = ({ label, hint, children }: {
  label: string
  hint?: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-y-1">
    <Label size="xsmall" weight="plus">{label}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text>}
  </div>
)

type Props = {
  productId: string
  variantId: string
  variantLabel: string
  initial: SupplyInfoFormInitial
  trigger: ReactNode
}

export const SupplyInfoDrawer = ({
  productId, variantId, variantLabel, initial, trigger,
}: Props) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => toForm(initial))
  const [updateSell, setUpdateSell] = useState(false)
  const queryClient = useQueryClient()

  // Re-seed from the saved record every time the drawer opens.
  useEffect(() => {
    if (open) {
      setForm(toForm(initial))
      setUpdateSell(false)
    }
  }, [open])

  const set = (key: keyof FormState) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const buy = numOrNull(form.buy)
  const markup = numOrNull(form.markup)
  const suggestedSell = buy !== null && markup ? round2(buy * markup) : null

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/supply-info/${variantId}`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      toast.success("Supply & cost saved")
      queryClient.invalidateQueries({ queryKey: ["product-supply-info", productId] })
      // The native variant/price sections read the product query.
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSave = () => {
    const sell = numOrNull(form.sell)
    if (updateSell && (sell === null || sell <= 0)) {
      toast.error("Enter a sell price above 0, or untick “Also set sell price”.")
      return
    }
    mutation.mutate({
      our_sku: textOrNull(form.our_sku),
      importer_sku: textOrNull(form.importer_sku),
      supplier_name: textOrNull(form.supplier_name),
      notes: textOrNull(form.notes),
      import_price_amount: buy,
      size: textOrNull(form.size),
      price_meta: {
        unit: textOrNull(form.unit),
        source: textOrNull(form.source),
        effective: textOrNull(form.effective),
        pdf_name: textOrNull(form.pdf_name),
        pdf_sku: textOrNull(form.pdf_sku),
        sf_per_box: numOrNull(form.sf_per_box),
        markup_applied: markup,
      },
      ...(updateSell && sell !== null ? { sell_price_cad: sell } : {}),
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Supply & cost</Drawer.Title>
          <Drawer.Description className="font-mono text-ui-fg-subtle">
            {variantLabel}
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buy price (CAD)">
              <Input type="number" step="0.01" min="0" value={form.buy} onChange={set("buy")} />
            </Field>
            <Field label="Unit">
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  {UNITS.map((u) => (
                    <Select.Item key={u.value} value={u.value}>{u.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <Field label="Size" hint={'e.g. 60" x 9", 24x48'}>
              <Input value={form.size} onChange={set("size")} />
            </Field>
            <Field label="Sq ft per box">
              <Input type="number" step="0.01" min="0" value={form.sf_per_box} onChange={set("sf_per_box")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price list source" hint="e.g. HTBC-Reno star Price list.pdf">
              <Input value={form.source} onChange={set("source")} />
            </Field>
            <Field label="Effective date">
              <Input type="date" value={form.effective} onChange={set("effective")} />
            </Field>
            <Field label="Name on price list">
              <Input value={form.pdf_name} onChange={set("pdf_name")} />
            </Field>
            <Field label="Code on price list">
              <Input value={form.pdf_sku} onChange={set("pdf_sku")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reno SKU">
              <Input value={form.our_sku} onChange={set("our_sku")} />
            </Field>
            <Field label="Supplier SKU">
              <Input value={form.importer_sku} onChange={set("importer_sku")} />
            </Field>
            <Field label="Supplier">
              <Input value={form.supplier_name} onChange={set("supplier_name")} />
            </Field>
            <Field label="Markup">
              <Input type="number" step="0.01" min="0" value={form.markup} onChange={set("markup")} />
            </Field>
          </div>

          <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3">
            <div className="flex items-center gap-x-2">
              <Checkbox
                id="update-sell"
                checked={updateSell}
                onCheckedChange={(c) => setUpdateSell(c === true)}
              />
              <Label htmlFor="update-sell" size="small">
                Also set sell price (storefront, CAD)
              </Label>
            </div>
            {updateSell && (
              <div className="flex items-end gap-x-2">
                <div className="flex-1">
                  <Input type="number" step="0.01" min="0" value={form.sell} onChange={set("sell")} />
                </div>
                {suggestedSell !== null && (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => setForm((f) => ({ ...f, sell: String(suggestedSell) }))}
                  >
                    Use buy × {markup} = ${suggestedSell.toFixed(2)}
                  </Button>
                )}
              </div>
            )}
          </div>

          <Field label="Notes">
            <Textarea value={form.notes} onChange={set("notes")} />
          </Field>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">Cancel</Button>
          </Drawer.Close>
          <Button size="small" onClick={onSave} isLoading={mutation.isPending}>
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
