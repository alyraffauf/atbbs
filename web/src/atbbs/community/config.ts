import shared from "../../../../data/shared.json";

export interface DefaultBoard {
  slug: string;
  name: string;
  description: string;
}

export const DEFAULT_BOARD = shared.default_board as DefaultBoard;
