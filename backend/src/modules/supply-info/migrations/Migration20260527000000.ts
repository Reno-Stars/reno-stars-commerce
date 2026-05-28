import { Migration } from "@mikro-orm/migrations";

export class Migration20260527000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `create table if not exists "supply_info" (
         "id" text not null,
         "our_sku" text null,
         "importer_sku" text null,
         "import_price_amount" numeric null,
         "raw_import_price_amount" jsonb null,
         "import_price_currency" text not null default 'cad',
         "supplier_name" text null,
         "spec" jsonb null,
         "notes" text null,
         "created_at" timestamptz not null default now(),
         "updated_at" timestamptz not null default now(),
         "deleted_at" timestamptz null,
         constraint "supply_info_pkey" primary key ("id")
       );`
    );

    this.addSql(
      `create unique index if not exists "IDX_supply_info_our_sku_unique"
       on "supply_info" ("our_sku")
       where "deleted_at" is null and "our_sku" is not null;`
    );

    this.addSql(
      `create index if not exists "IDX_supply_info_importer_sku"
       on "supply_info" ("importer_sku")
       where "deleted_at" is null;`
    );

    this.addSql(
      `create index if not exists "IDX_supply_info_supplier_name"
       on "supply_info" ("supplier_name")
       where "deleted_at" is null;`
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "supply_info" cascade;');
  }
}
