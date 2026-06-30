import { Pos } from "../types";

export interface CollapseStrategy {
  collapse(delayTime: number, rm: Pos[]): void;
}