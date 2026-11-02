import type Connection from './connection';
declare const scram: {
    /**
     * Whether the Web Crypto `SubtleCrypto` API that SCRAM relies on is available.
     */
    supported(): boolean;
    /**
     * On success, sets
     * connection_sasl_data["server-signature"]
     * and
     * connection._sasl_data.keys
     *
     * The server signature should be verified after this function completes..
     *
     * On failure, returns connection._sasl_failure_cb();
     * @param connection
     * @param challenge
     * @param hashName
     * @param hashBits
     */
    scramResponse(connection: Connection, challenge: string, hashName: string, hashBits: number): Promise<string | false>;
    /**
     * Returns a string containing the client first message
     * @param connection
     * @param test_cnonce
     */
    clientChallenge(connection: Connection, test_cnonce?: string): string;
};
export { scram as default };
//# sourceMappingURL=scram.d.ts.map