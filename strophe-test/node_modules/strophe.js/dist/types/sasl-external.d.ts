import type Connection from './connection';
import SASLMechanism from './sasl';
declare class SASLExternal extends SASLMechanism {
    constructor(mechname?: string, isClientFirst?: boolean, priority?: number);
    onChallenge(connection: Connection): string;
}
export default SASLExternal;
//# sourceMappingURL=sasl-external.d.ts.map