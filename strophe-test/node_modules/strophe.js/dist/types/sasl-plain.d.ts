import type Connection from './connection';
import SASLMechanism from './sasl';
declare class SASLPlain extends SASLMechanism {
    constructor(mechname?: string, isClientFirst?: boolean, priority?: number);
    test(connection: Connection): boolean;
    onChallenge(connection: Connection): string;
}
export default SASLPlain;
//# sourceMappingURL=sasl-plain.d.ts.map