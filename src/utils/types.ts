export interface DBField {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  isIncrement: boolean;
  defaultValue?: string;
  note?: string;
}

export interface DBTable {
  id: string;
  name: string;
  schema: string;
  fields: DBField[];
  note?: string;
}

export interface DBRelationship {
  id: string;
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  cardinality: '1:1' | '1:N' | 'N:N';
}

export interface ParsedSchema {
  tables: DBTable[];
  relationships: DBRelationship[];
}
