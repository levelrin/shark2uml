window.onload = () => {
    initPlantUml();
    listenToFileInput();
    listenToCopy();
    listenToSharkJsonInput();
    listenToPlantUmlInput();
}

function listenToPlantUmlInput() {
    const textarea = document.getElementById("plantuml-textarea");
    let debounceTimeout;
    textarea.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            renderPlantUml();
        }, 2000);
    });
}

function listenToSharkJsonInput() {
    const textarea = document.getElementById("shark-json-textarea");
    let debounceTimeout;
    textarea.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            overwritePlantUmlTextArea();
            renderPlantUml();
        }, 2000);
    });
}

function initPlantUml() {
    cheerpjInit({disableLoadTimeReporting:true, disableErrorReporting:true}).then(_ => {
        // This path is for GitHub Pages.
        // For local development, we need to change it to `/app/plantuml/plantuml-core.jar`.
        // The `/app/` would be the domain name. Ex: `http://localhost/`.
        // If the web app is locally hosted, the file should be accessible like this: `http://localhost/plantuml/plantuml-core.jar`.
        // However, since the web app would be hosted as a subdirectory in GitHub Pages (ex: https://levelrin.github.io/shark2uml/), we need to add the repository name after `/app/`.
        // By the way, it only works in HTTP(S) protocol.
        // Just opening the `index.html` file using `file://` scheme won't work.
        cheerpjRunMain("com.plantuml.api.cheerpj.v1.RunInit", "/app/shark2uml/plantuml/plantuml-core.jar");
        // Use this instead for local debugging.
        //cheerpjRunMain("com.plantuml.api.cheerpj.v1.RunInit", "/app/plantuml/plantuml-core.jar");
    });
}

function listenToCopy() {
    document.getElementById("copy-btn").addEventListener("click", function () {
        const text = document.getElementById("command-text").innerText;
        navigator.clipboard.writeText(text).then(() => {
            this.innerText = "Copied!";
            setTimeout(() => this.innerText = "Copy", 1500);
        });
    });
}

function listenToFileInput() {
    const fileInput = document.getElementById("shark-json-file-input");
    fileInput.addEventListener("change", function () {
        if (this.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = function(event) {
                const result = event.target.result;
                if (typeof result !== "string") {
                    alert("The file could not be read as a string.");
                    return;
                }
                overwriteSharkJsonOnTextarea(result);
                overwritePlantUmlTextArea();
                renderPlantUml();
            };
            reader.onerror = function() {
                alert("Failed to read the file.");
            };
            reader.readAsText(file);
        }
    });
}

function renderPlantUml() {
    const plantUmlTextArea = document.getElementById("plantuml-textarea");
    const plantUmlCode = plantUmlTextArea.value;
    cjCall("com.plantuml.api.cheerpj.v1.Svg", "convert", "light", plantUmlCode).then(svg => {
        document.getElementById("plantuml-render").innerHTML = svg;
    }).catch(err => {
        console.error("Failed to render PlantUML:", err);
    });
}

function overwriteSharkJsonOnTextarea(sharkJsonString) {
    const textArea = document.getElementById("shark-json-textarea");
    textArea.value = sharkJsonString;
}

function overwritePlantUmlTextArea() {
    const sharkJsonTextArea = document.getElementById("shark-json-textarea");
    const sharkJsonString = sharkJsonTextArea.value;
    const sharkJson = JSON.parse(sharkJsonString);
    const plantUml = generatePlantUml(sharkJson);
    const plantUmlTextArea = document.getElementById("plantuml-textarea");
    plantUmlTextArea.value = plantUml;
}

function generatePlantUml(sharkJson) {
    const stringBuilder = []
    stringBuilder.push("@startuml\nskinparam maxMessageSize 500\n");
    const listener = new SharkJsonListenerForPlantUml(stringBuilder);
    walkSharkJson(sharkJson, listener);
    stringBuilder.push("\n@enduml\n");
    return stringBuilder.join("");
}

function walkSharkJson(sharkJson, listener) {
    sharkJson.forEach(message => {
        // Ex: ["google.com"]
        const httpHost = message._source?.layers?.["http.host"];
        if (httpHost !== undefined) {
            listener.enterHttpHost(httpHost[0]);
        }
        // Ex: ["GET"]
        const httpRequestMethod = message._source?.layers?.["http.request.method"];
        if (httpRequestMethod !== undefined) {
            listener.enterHttpRequestMethod(httpRequestMethod[0]);
        }
        // Ex: ["/"]
        const httpRequestUri = message._source?.layers?.["http.request.uri"];
        if (httpRequestUri !== undefined) {
            listener.enterHttpRequestUri(httpRequestUri[0]);
        }
        // Ex: ["HTTP/1.1"]
        const httpRequestVersion = message._source?.layers?.["http.request.version"];
        if (httpRequestVersion !== undefined) {
            listener.enterHttpRequestVersion(httpRequestVersion[0]);
        }
        // Ex:
        // [
        //   "Host: google.com\r\n",
        //   "User-Agent: curl/7.68.0\r\n",
        //   "Accept: */*\r\n"
        // ]
        // Wireshark uses the attribute `http.request.line`, for some reason, but it's actually headers.
        // Also note that each header ends with a linebreak.
        const httpRequestLine = message._source?.layers?.["http.request.line"];
        if (httpRequestLine !== undefined) {
            listener.enterHttpRequestLine(httpRequestLine);
        }
        // Ex: ["HTTP/1.1"]
        const httpResponseVersion = message._source?.layers?.["http.response.version"];
        if (httpResponseVersion !== undefined) {
            listener.enterHttpResponseVersion(httpResponseVersion[0]);
        }
        // Ex: ["301"]
        const httpResponseCode = message._source?.layers?.["http.response.code"];
        if (httpResponseCode !== undefined) {
            listener.enterHttpResponseCode(httpResponseCode[0]);
        }
        // Ex: ["Moved Permanently"]
        const httpResponseCodeDesc = message._source?.layers?.["http.response.code.desc"];
        if (httpResponseCodeDesc !== undefined) {
            listener.enterHttpResponseCodeDesc(httpResponseCodeDesc[0]);
        }
        // Ex:
        // [
        //   "Location: http://www.google.com/\r\n",
        //   "Content-Type: text/html; charset=UTF-8\r\n",
        //   "Content-Security-Policy-Report-Only: object-src 'none';base-uri 'self';script-src 'nonce-_20za8DbHh_Q4PaeZgZ5ZQ' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp\r\n",
        //   "Date: Sun, 27 Jul 2025 23:50:18 GMT\r\n",
        //   "Expires: Tue, 26 Aug 2025 23:50:18 GMT\r\n",
        //   "Cache-Control: public, max-age=2592000\r\n",
        //   "Server: gws\r\n",
        //   "Content-Length: 219\r\n",
        //   "X-XSS-Protection: 0\r\n",
        //   "X-Frame-Options: SAMEORIGIN\r\n"
        // ]
        // Wireshark uses the attribute `http.response.line`, for some reason, but it's actually headers.
        // Also note that each header ends with a linebreak.
        const httpResponseLine = message._source?.layers?.["http.response.line"];
        if (httpResponseLine !== undefined) {
            listener.enterHttpResponseLine(httpResponseLine);
        }
        // Ex: ["<HTML><HEAD><meta http-equiv=\"content-type\" content=\"text/html;charset=utf-8\">\n<TITLE>301 Moved<\/TITLE><\/HEAD><BODY>\n<H1>301 Moved<\/H1>\nThe document has moved\n<A HREF=\"http://www.google.com/\">here<\/A>.\r\n<\/BODY><\/HTML>\r\n"]
        const httpFileData = message._source?.layers?.["http.file_data"];
        if (httpFileData !== undefined) {
            listener.enterHttpFileData(httpFileData[0]);
        }
        // Request Ex: [":method", ":scheme", ":authority", ":path", "user-agent", "accept"]
        // Response Ex: [":status", "location", "content-type", "content-security-policy-report-only", "date", "expires", "cache-control", "server", "content-length", "x-xss-protection", "x-frame-options", "alt-svc"]
        const http2HeaderName = message._source?.layers?.["http2.header.name"];
        // Request Ex: ["GET", "https", "google.com", "/", "curl/8.7.1", "*/*"]
        // Response Ex: ["301", "https://www.google.com/", "text/html; charset=UTF-8", "object-src 'none';base-uri 'self';script-src 'nonce-bCLHu' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp", "Sun, 10 Aug 2025 20:46:02 GMT", "Tue, 09 Sep 2025 20:46:02 GMT", "public, max-age=2592000", "gws", "220", "0", "SAMEORIGIN", "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000"]
        const http2HeaderValue = message._source?.layers?.["http2.header.value"];
        if (http2HeaderName !== undefined && http2HeaderValue !== undefined) {
            listener.enterHttp2HeaderNameAndHttp2HeaderValue(http2HeaderName, http2HeaderValue);
        }
        // HTTP 2 Body in binary (hex).
        // Ex: [binary]
        const http2BodyReassembledData = message._source?.layers?.["http2.body.reassembled.data"];
        if (http2BodyReassembledData !== undefined) {
            listener.enterHttp2BodyReassembledData(http2BodyReassembledData[0]);
        }
    });
}

/**
 * This function has been generated by ChatGPT.
 * If the `input` is a hex, we convert it to a String.
 * If the `input` is a String already, we return it as is.
 * @param input This can be either hex or String.
 * @param encoding UTF-8 by default.
 * @returns {*|string} Already explained.
 */
function decodeHexOrString(input, encoding = "utf-8") {
    const isHex = /^[0-9a-fA-F]+$/.test(input) && input.length % 2 === 0;
    if (!isHex) {
        return input;
    }
    const bytes = new Uint8Array(input.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(input.slice(i * 2, i * 2 + 2), 16);
    }
    const decoder = new TextDecoder(encoding);
    return decoder.decode(bytes);
}

class SharkJsonListenerForPlantUml {

    /**
     * As is.
     * @param stringBuilder Array of strings, in which we will write PlantUML into this.
     */
    constructor(stringBuilder) {
        this.stringBuilder = stringBuilder;
    }

    /**
     * Handle the host.
     * @param host Ex: "google.com"
     */
    enterHttpHost(host) {
        this.host = host;
    }

    /**
     * Handle the HTTP request method.
     * @param requestMethod Ex: "GET"
     */
    enterHttpRequestMethod(requestMethod) {
        this.stringBuilder.push("\nlocal -> " + this.host + ": <color red>" + requestMethod + " ");
    }

    /**
     * Handle the HTTP URI.
     * @param requestUri Ex: "/"
     */
    enterHttpRequestUri(requestUri) {
        this.stringBuilder.push(requestUri + " ");
    }

    /**
     * Handle the HTTP version.
     * @param version Ex: "HTTP/1.1"
     */
    enterHttpRequestVersion(version) {
        this.stringBuilder.push(version + "</color>\\n");
    }

    /**
     * Handle the HTTP request headers.
     * Ex:
     * [
     *   "Host: google.com\r\n",
     *   "User-Agent: curl/7.68.0\r\n",
     *   "Accept: *\/*\r\n"
     * ]
     * Note that each header ends with a linebreak.
     * @param headers Already explained.
     */
    enterHttpRequestLine(headers) {
        for (let index = 0; index < headers.length; index++) {
            const header = headers[index];
            const [name, ...rest] = header.split(":");
            const headerName = name.trim();
            const headerValue = rest.join(":").trim();
            this.stringBuilder.push("<color blue>" + headerName + "</color>: ");
            this.stringBuilder.push("<color green>" + headerValue + "</color>\\n");
            if (index === headers.length - 1) {
                this.stringBuilder.push("\\n");
            }
        }
    }

    /**
     * Handle the HTTP version.
     * @param version Ex: "HTTP/1.1"
     */
    enterHttpResponseVersion(version) {
        this.stringBuilder.push("\nlocal <<-- " + this.host + ": <color red>" + version + " ");
    }

    /**
     * Handle the status code.
     * @param statusCode Ex: "301"
     */
    enterHttpResponseCode(statusCode) {
        this.stringBuilder.push(statusCode + " ");
    }

    /**
     * Handle the reason phrase.
     * @param reasonPhrase Ex: "Moved Permanently"
     */
    enterHttpResponseCodeDesc(reasonPhrase) {
        this.stringBuilder.push(reasonPhrase + "</color>\\n");
    }

    /**
     * Handle the HTTP response headers.
     * Ex:
     * [
     *   "Location: http://www.google.com/\r\n",
     *   "Content-Type: text/html; charset=UTF-8\r\n",
     *   "Content-Security-Policy-Report-Only: object-src 'none';base-uri 'self';script-src 'nonce-_20za8DbHh_Q4PaeZgZ5ZQ' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp\r\n",
     *   "Date: Sun, 27 Jul 2025 23:50:18 GMT\r\n",
     *   "Expires: Tue, 26 Aug 2025 23:50:18 GMT\r\n",
     *   "Cache-Control: public, max-age=2592000\r\n",
     *   "Server: gws\r\n",
     *   "Content-Length: 219\r\n",
     *   "X-XSS-Protection: 0\r\n",
     *   "X-Frame-Options: SAMEORIGIN\r\n"
     * ]
     * Note that each header ends with a linebreak.
     * @param headers Already explained.
     */
    enterHttpResponseLine(headers) {
        // We can use the same logic.
        this.enterHttpRequestLine(headers);
    }

    /**
     * Handle the HTTP body.
     * @param body Ex: "<HTML><HEAD><meta http-equiv=\"content-type\" content=\"text/html;charset=utf-8\">\n<TITLE>301 Moved<\/TITLE><\/HEAD><BODY>\n<H1>301 Moved<\/H1>\nThe document has moved\n<A HREF=\"http://www.google.com/\">here<\/A>.\r\n<\/BODY><\/HTML>\r\n"
     *             Or, it can be hex value. In that case, we need to convert it to String.
     */
    enterHttpFileData(body) {
        this.stringBuilder.push(decodeHexOrString(body).replaceAll("\r", "\\r").replaceAll("\n", "\\n"));
    }

    /**
     * Handle (request line or response line) + headers.
     * @param http2HeaderName Request Ex: [":method", ":scheme", ":authority", ":path", "user-agent", "accept"]
     *                        Response Ex: [":status", "location", "content-type", "content-security-policy-report-only", "date", "expires", "cache-control", "server", "content-length", "x-xss-protection", "x-frame-options", "alt-svc"]
     * @param http2HeaderValue Request Ex: ["GET", "https", "google.com", "/", "curl/8.7.1", "*\/*"]
     *                         Response Ex: ["301", "https://www.google.com/", "text/html; charset=UTF-8", "object-src 'none';base-uri 'self';script-src 'nonce-bCLHu' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp", "Sun, 10 Aug 2025 20:46:02 GMT", "Tue, 09 Sep 2025 20:46:02 GMT", "public, max-age=2592000", "gws", "220", "0", "SAMEORIGIN", "h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000"]
     */
    enterHttp2HeaderNameAndHttp2HeaderValue(http2HeaderName, http2HeaderValue) {
        if (http2HeaderName.includes(":method")) {
            // It's a request.
            const authorityIndex = http2HeaderName.indexOf(":authority");
            this.host = http2HeaderValue[authorityIndex];
            this.stringBuilder.push("\nlocal -> " + this.host + ":\\n");
        } else if (http2HeaderName.includes(":status")) {
            // It's a response.
            this.stringBuilder.push("\nlocal <<-- " + this.host + ":\\n");
        }
        for (let index = 0; index < http2HeaderName.length; index++) {
            this.stringBuilder.push("<color blue>" + http2HeaderName[index] + "</color>: <color green>" + http2HeaderValue[index] + "</color>\\n");
            if (index === http2HeaderName.length - 1) {
                this.stringBuilder.push("\\n");
            }
        }
    }

    /**
     * Handle the HTTP 2 body.
     * @param body Binary in hex.
     */
    enterHttp2BodyReassembledData(body) {
        // Same as HTTP 1.
        this.enterHttpFileData(body);
    }

}
