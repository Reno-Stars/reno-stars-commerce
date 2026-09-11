/* One-time, idempotent publication of the reviewed inventory; read-only by default. */
const inventory = require('/app/src/scripts/data/cabinet-inventory.json');
module.exports.default = async function ({ container }) {
  const service = container.resolve('product');
  const apply = process.env.CABINET_PUBLISH === '1';
  const eligible = inventory.products.filter(p => p.review_status === 'draft_visual_limitations');
  const held = inventory.products.filter(p => p.review_status !== 'draft_visual_limitations');
  if (eligible.length !== 1609 || held.length !== 125) throw Error('Unexpected inventory revision');
  const plan = [];
  const categoryPlan = new Map();
  // Validate every candidate before the first write. Never publish an unmatched record.
  for (const p of eligible) {
    const matches = await service.listProducts({ handle: p.id }, { relations: ['categories', 'variants'] });
    if (matches.length !== 1) throw Error(`Expected exactly one product: ${p.id}`);
    const product = matches[0], m = product.metadata || {}, d = p.dimensions_mm;
    if (!['draft','published'].includes(product.status) || m.review_status !== p.review_status || m.pricing_mode !== 'quote_only' || m.model_finish_basis !== 'visual_approximation' || m.model_url !== `https://supply.reno-stars.com${p.model_url}` || m.width_mm !== d.w || m.height_mm !== d.h || m.depth_mm !== d.d) throw Error(`Product preflight mismatch: ${p.id}`);
    const categoryName = [p.brand,p.finish,p.construction].filter(Boolean).join(' — ');
    const handle = categoryName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
    const category = product.categories.find(c => c.handle === handle);
    if (!category) throw Error(`Category mismatch: ${p.id}`);
    categoryPlan.set(category.id, { id: category.id, name: [p.finish,p.construction].filter(Boolean).join(' — '), brand: p.brand });
    plan.push(product);
  }
  for (const p of held) {
    if ((await service.listProducts({ handle:p.id })).some(v => v.status === 'published')) throw Error(`Held product already published: ${p.id}`);
  }
  console.log(JSON.stringify({phase:'preflight',apply,eligible:plan.length,drafts:plan.filter(p=>p.status==='draft').length,published:plan.filter(p=>p.status==='published').length,held:held.length,categories:categoryPlan.size}));
  if (!apply) return;
  async function ensureCategory(handle,name,parent) {
    let [category] = await service.listProductCategories({handle});
    if (!category) category = await service.createProductCategories({handle,name,is_active:true,is_internal:false,parent_category_id:parent || null});
    else if (category.parent_category_id !== (parent || null)) throw Error(`Unexpected parent for ${handle}`);
    return category;
  }
  const root = await ensureCategory('cabinets','Cabinets');
  const brands = new Map();
  for (const c of categoryPlan.values()) {
    if (!brands.has(c.brand)) brands.set(c.brand,await ensureCategory(`cabinets-${c.brand.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,c.brand,root.id));
    await service.updateProductCategories(c.id,{name:c.name,parent_category_id:brands.get(c.brand).id,is_active:true,is_internal:false});
  }
  for (const p of plan) {
    await service.updateProducts(p.id,{status:'published',metadata:{...p.metadata,publication_approved:true,publication_basis:'customer_requested_public_visualization',published_for_catalog_at:p.metadata.published_for_catalog_at || new Date().toISOString()}});
    console.log(`Published ${p.handle}`);
  }
  let verified = 0;
  for (const p of plan) {
    const [actual] = await service.listProducts({id:p.id});
    if (actual.status !== 'published' || actual.metadata.pricing_mode !== 'quote_only' || actual.metadata.publication_approved !== true) throw Error(`Verification failed: ${p.handle}`);
    verified++;
  }
  console.log(JSON.stringify({phase:'complete',published:verified,held:held.length,root:root.handle,brands:[...brands.keys()]}));
};
