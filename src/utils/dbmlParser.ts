import { Parser } from '@dbml/core';
import type { ParsedSchema, DBTable, DBField, DBRelationship } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFieldType(field: any): string {
  const typeName = field.type?.type_name ?? 'unknown';
  const args = field.type?.args;
  return args ? `${typeName}(${args})` : typeName;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDefaultValue(field: any): string | undefined {
  if (!field.dbdefault) return undefined;
  return String(field.dbdefault.value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCardinality(rel1: string, rel2: string): DBRelationship['cardinality'] {
  if (rel1 === '1' && rel2 === '1') return '1:1';
  if (rel1 === '*' && rel2 === '*') return 'N:N';
  if (rel1 === '<>' || rel2 === '<>') return 'N:N';
  if (rel1 === '-' || rel2 === '-') return '1:1';
  return '1:N';
}

export function parseDBML(content: string): ParsedSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (Parser as any).parse(content, 'dbml') as any;

  const tables: DBTable[] = [];
  const relationships: DBRelationship[] = [];

  for (const schema of database.schemas ?? []) {
    for (const table of schema.tables ?? []) {
      const fields: DBField[] = (table.fields ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (field: any): DBField => ({
          name: field.name,
          type: getFieldType(field),
          isPrimaryKey: field.pk ?? false,
          isNotNull: field.not_null ?? false,
          isUnique: field.unique ?? false,
          isIncrement: field.increment ?? false,
          defaultValue: getDefaultValue(field),
          note: field.note ?? undefined,
        })
      );

      tables.push({
        id: table.name,
        name: table.name,
        schema: schema.name ?? 'public',
        fields,
        note: table.note ?? undefined,
      });
    }
  }

  const tableIds = new Set(tables.map((t) => t.id));

  let refIndex = 0;
  // In @dbml/core v3, refs live on each schema object, NOT on the database root
  for (const schema of database.schemas ?? []) {
  for (const ref of schema.refs ?? []) {
    const endpoints = ref.endpoints ?? [];
    if (endpoints.length !== 2) continue;

    const [ep1, ep2] = endpoints;
    const fromTable: string = ep1.tableName ?? ep1.table?.name ?? '';
    const toTable: string = ep2.tableName ?? ep2.table?.name ?? '';

    if (!tableIds.has(fromTable) || !tableIds.has(toTable)) continue;

    const fromField: string = (ep1.fieldNames ?? ep1.fields?.map((f: any) => f.name) ?? [])[0] ?? '';
    const toField: string = (ep2.fieldNames ?? ep2.fields?.map((f: any) => f.name) ?? [])[0] ?? '';

    const cardinality = getCardinality(ep1.relation ?? '', ep2.relation ?? '');

    relationships.push({
      id: `ref_${refIndex++}`,
      fromTable,
      fromField,
      toTable,
      toField,
      cardinality,
    });
  }
  }

  return { tables, relationships };
}

export const SAMPLE_DBML = `Table users {
  id integer [pk, increment, note: 'Auto-incremented primary key']
  username varchar(50) [not null, unique, note: 'Unique login handle']
  email varchar(100) [not null, unique, note: 'Contact and login email']
  role varchar(20) [not null, default: 'user', note: 'user | admin | moderator']
  created_at timestamp [default: \`now()\`, note: 'Account creation time']

  Note: 'Registered application users'
}

Table posts {
  id integer [pk, increment]
  title varchar(200) [not null, note: 'Post headline']
  content text [note: 'Full post body in markdown']
  user_id integer [not null, note: 'Author reference']
  status varchar(20) [default: 'draft', note: 'draft | published | archived']
  created_at timestamp [default: \`now()\`]
  published_at timestamp [note: 'Set when status changes to published']

  Note: 'Blog posts authored by users'
}

Table comments {
  id integer [pk, increment]
  content text [not null, note: 'Comment body text']
  post_id integer [not null, note: 'Parent post reference']
  user_id integer [not null, note: 'Commenter reference']
  created_at timestamp [default: \`now()\`]
}

Table tags {
  id integer [pk, increment]
  name varchar(50) [not null, unique, note: 'Tag label shown to users']
  color varchar(7) [note: 'Hex color code, e.g. #ff5733']
}

Table post_tags {
  post_id integer [note: 'References posts.id']
  tag_id integer [note: 'References tags.id']

  indexes {
    (post_id, tag_id) [pk]
  }
}

Ref: posts.user_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id
Ref: post_tags.post_id > posts.id
Ref: post_tags.tag_id > tags.id`;
