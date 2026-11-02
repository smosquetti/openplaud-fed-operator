import type Connection from './connection';
import SASLMechanism from './sasl';
declare class SASLSHA384 extends SASLMechanism {
    constructor(mechname?: string, isClientFirst?: boolean, priority?: number);
    test(connection: Connection): boolean;
    onChallenge(connection: Connection, challenge?: string): Promise<string | false>;
    clientChallenge(connection: Connection, test_cnonce?: string): string;
}
export default SASLSHA384;
//# sourceMappingURL=sasl-sha384.d.ts.map