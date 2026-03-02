export interface SmartDocument {
  id: number;
  wallet_address: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  s3_url: string;
  document_type?: string;
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: DocumentMetadata;
  ocr_error?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentMetadata {
  document_type: string;
  title: string;
  summary: string;
  dates: DateField[];
  parties: Party[];
  amounts: Amount[];
  key_fields: Record<string, string>;
  language: string;
  confidence: number;
}

export interface DateField {
  label: string;
  value: string;
}

export interface Party {
  role: string;
  name: string;
}

export interface Amount {
  label: string;
  value: string;
  currency: string;
}

// Document sharing types

export interface DocumentShare {
  id: number;
  document_id: number;
  document_hash: string;
  owner_address: string;
  recipient_address: string;
  token_id?: number;
  tx_hash?: string;
  expires_at: string;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  revoke_tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface SharedDocumentInfo {
  id: number;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  document_type?: string;
  created_at: string;
}

export interface SharedDocumentView {
  share: DocumentShare;
  document: SharedDocumentInfo;
}

export interface InitiateShareResponse {
  share_id: number;
  document_hash: string;
}
