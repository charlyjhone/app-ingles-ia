#!/usr/bin/env node
/**
 * Trava de segurança das migrações (roda no CI antes de tudo).
 *
 * 1. Migrações já publicadas NÃO podem ser editadas (o hash fica registrado
 *    em supabase/migrations.lock). Corrigir = criar uma migração nova.
 * 2. Comandos destrutivos (DROP TABLE, DROP COLUMN, TRUNCATE, DELETE sem WHERE,
 *    RENAME) são bloqueados, a menos que a linha tenha o marcador
 *    `-- allow-destructive: <motivo>` (e só depois da fase "contract",
 *    ver docs/MUDANCAS-SEGURAS.md).
 * 3. Toda tabela criada precisa de RLS ligado na mesma migração.
 *
 * Uso: node scripts/check-migrations.mjs          (verifica)
 *      node scripts/check-migrations.mjs --lock   (registra migrações novas)
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../supabase/migrations/", import.meta.url).pathname;
const lockPath = new URL("../supabase/migrations.lock", import.meta.url).pathname;
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : {};
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const DESTRUCTIVE = [
  /\bdrop\s+table\b/i,
  /\bdrop\s+column\b/i,
  /^\s*truncate\b/i,
  /\bdelete\s+from\s+[\w."]+\s*;/i,
  /\brename\s+(column|to)\b/i,
  /\balter\s+column\s+[\w"]+\s+type\b/i,
  /\bdisable\s+row\s+level\s+security\b/i,
];

const errors = [];
let changedLock = false;

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");

  if (lock[file] && lock[file] !== hash) {
    errors.push(`${file}: migração já publicada foi EDITADA. Crie uma migração nova em vez de alterar esta.`);
  }
  if (!lock[file]) {
    if (process.argv.includes("--lock")) {
      lock[file] = hash;
      changedLock = true;
    } else {
      console.log(`• ${file}: nova (rode "node scripts/check-migrations.mjs --lock" ao publicar)`);
    }
  }

  sql.split("\n").forEach((line, i) => {
    const code = line.replace(/--.*$/, "");
    if (DESTRUCTIVE.some((re) => re.test(code)) && !/--\s*allow-destructive:\s*\S+/.test(line)) {
      errors.push(`${file}:${i + 1}: comando destrutivo bloqueado → ${line.trim()}`);
    }
  });

  const tables = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)].map((m) => m[1]);
  for (const t of tables) {
    const re = new RegExp(`alter\\s+table\\s+${t.replace(".", "\\.")}\\s+enable\\s+row\\s+level\\s+security`, "i");
    if (!re.test(sql)) errors.push(`${file}: tabela ${t} criada sem RLS ligado.`);
  }
}

if (changedLock) writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

if (errors.length) {
  console.error("\n✗ Migrações reprovadas:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`✓ ${files.length} migração(ões) aprovada(s).`);
