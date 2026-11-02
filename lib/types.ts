/** Operator as returned by GET /operators and POST /operators. */
export interface Operator {
  id: string;
  name: string;
  email: string;
  xmppUser: string;
}

/** Group (persistent MUC room) as returned by GET /operators/{id}/groups. */
export interface Group {
  id: string;
  name: string;
  room: string;
  service?: string;
}

export interface ApiErrorBody {
  status: number;
  code: number;
  message: string;
  fields?: Record<string, string>;
}
