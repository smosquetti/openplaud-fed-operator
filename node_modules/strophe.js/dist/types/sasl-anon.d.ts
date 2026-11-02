import type Connection from './connection';
import SASLMechanism from './sasl';
declare class SASLAnonymous extends SASLMechanism {
    constructor(mechname?: string, isClientFirst?: boolean, priority?: number);
    test(connection: Connection): boolean;
}
export default SASLAnonymous;
//# sourceMappingURL=sasl-anon.d.ts.map