import { util } from '../../FrameWork/Utils/util';
import { Pos } from '../types';
import type { CollapseStrategy } from './CollapseStrategy';

export class NoneCollapse implements CollapseStrategy {
    collapse(delayTime: number, rm: Pos[]) {
        util.Log("NoneCollapse", delayTime, rm);
    }
}


