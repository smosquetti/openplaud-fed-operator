/**
 * Helper class that provides a cross implementation abstraction
 * for a BOSH related XMLHttpRequest.
 *
 * The Request class is used internally to encapsulate BOSH request
 * information.  It is not meant to be used from user's code.
 */
declare class Request {
    id: number;
    xmlData: Element;
    data: string;
    origFunc: (req: Request) => void;
    func: (req: Request) => void;
    rid: number;
    date: number;
    sends: number;
    abort: boolean;
    dead: Date | null;
    age: () => number;
    timeDead: () => number;
    xhr: XMLHttpRequest;
    /**
     * Create and initialize a new Request object.
     *
     * @param elem - The XML data to be sent in the request.
     * @param func - The function that will be called when the
     *     XMLHttpRequest readyState changes.
     * @param rid - The BOSH rid attribute associated with this request.
     * @param sends - The number of times this same request has been sent.
     */
    constructor(elem: Element, func: (req: Request) => void, rid: number, sends?: number);
    /**
     * Get a response from the underlying XMLHttpRequest.
     * This function attempts to get a response from the request and checks
     * for errors.
     * @throws "parsererror" - A parser error occured.
     * @throws "bad-format" - The entity has sent XML that cannot be processed.
     * @returns The DOM element tree of the response.
     */
    getResponse(): Element | null;
    /**
     * _Private_ helper function to create XMLHttpRequests.
     * This function creates XMLHttpRequests across all implementations.
     * @private
     */
    _newXHR(): XMLHttpRequest;
}
export default Request;
//# sourceMappingURL=request.d.ts.map