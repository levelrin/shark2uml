window.onload = () => {
    listenToFileInput();
    listenToCopy();
    initPlantUml();
}

function initPlantUml() {
    cheerpjInit({disableLoadTimeReporting:true, disableErrorReporting:true}).then(_ => {
        cheerpjRunMain("com.plantuml.api.cheerpj.v1.RunInit", "/app/plantuml/plantuml-core.jar");
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
        const host = message._source?.layers?.["http.host"];
        if (host !== undefined) {
            listener.enterHost(host[0]);
        }
        // Ex: ["GET"]
        const requestMethod = message._source?.layers?.["http.request.method"];
        if (requestMethod !== undefined) {
            listener.enterRequestMethod(requestMethod[0]);
        }
        // Ex: ["/"]
        const requestUri = message._source?.layers?.["http.request.uri"];
        if (requestUri !== undefined) {
            listener.enterRequestUri(requestUri[0]);
        }
        // Ex: ["HTTP/1.1"]
        const requestVersion = message._source?.layers?.["http.request.version"];
        if (requestVersion !== undefined) {
            listener.enterRequestVersion(requestVersion[0]);
        }
        // Ex:
        // [
        //   "Host: google.com\r\n",
        //   "User-Agent: curl/7.68.0\r\n",
        //   "Accept: */*\r\n"
        // ]
        // Wireshark uses the attribute `http.request.line`, for some reason, but it's actually headers.
        // Also note that each header ends with a linebreak.
        const requestHeaders = message._source?.layers?.["http.request.line"];
        if (requestHeaders !== undefined) {
            listener.enterRequestHeaders(requestHeaders);
        }
        // Ex: ["HTTP/1.1"]
        const responseVersion = message._source?.layers?.["http.response.version"];
        if (responseVersion !== undefined) {
            listener.enterResponseVersion(responseVersion[0]);
        }
        // Ex: ["301"]
        const statusCode = message._source?.layers?.["http.response.code"];
        if (statusCode !== undefined) {
            listener.enterStatusCode(statusCode[0]);
        }
        // Ex: ["Moved Permanently"]
        const reasonPhrase = message._source?.layers?.["http.response.code.desc"];
        if (reasonPhrase !== undefined) {
            listener.enterReasonPhrase(reasonPhrase[0]);
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
        const responseHeaders = message._source?.layers?.["http.response.line"];
        if (responseHeaders !== undefined) {
            listener.enterResponseHeaders(responseHeaders);
        }
        // Ex: ["<HTML><HEAD><meta http-equiv=\"content-type\" content=\"text/html;charset=utf-8\">\n<TITLE>301 Moved<\/TITLE><\/HEAD><BODY>\n<H1>301 Moved<\/H1>\nThe document has moved\n<A HREF=\"http://www.google.com/\">here<\/A>.\r\n<\/BODY><\/HTML>\r\n"]
        const body = message._source?.layers?.["http.file_data"];
        if (body !== undefined) {
            listener.enterBody(body[0]);
        }
    });
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
    enterHost(host) {
        this.host = host;
    }

    /**
     * Handle the HTTP request method.
     * @param requestMethod Ex: "GET"
     */
    enterRequestMethod(requestMethod) {
        this.stringBuilder.push("\nlocal -> " + this.host + ": <color red>" + requestMethod + " ");
    }

    /**
     * Handle the HTTP URI.
     * @param requestUri Ex: "/"
     */
    enterRequestUri(requestUri) {
        this.stringBuilder.push(requestUri + " ");
    }

    /**
     * Handle the HTTP version.
     * @param version Ex: "HTTP/1.1"
     */
    enterRequestVersion(version) {
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
    enterRequestHeaders(headers) {
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
    enterResponseVersion(version) {
        this.stringBuilder.push("\nlocal <<-- " + this.host + ": <color red>" + version + " ");
    }

    /**
     * Handle the status code.
     * @param statusCode Ex: "301"
     */
    enterStatusCode(statusCode) {
        this.stringBuilder.push(statusCode + " ");
    }

    /**
     * Handle the reason phrase.
     * @param reasonPhrase Ex: "Moved Permanently"
     */
    enterReasonPhrase(reasonPhrase) {
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
    enterResponseHeaders(headers) {
        // We can use the same logic.
        this.enterRequestHeaders(headers);
    }

    /**
     * Handle the HTTP body.
     * @param body Ex: "<HTML><HEAD><meta http-equiv=\"content-type\" content=\"text/html;charset=utf-8\">\n<TITLE>301 Moved<\/TITLE><\/HEAD><BODY>\n<H1>301 Moved<\/H1>\nThe document has moved\n<A HREF=\"http://www.google.com/\">here<\/A>.\r\n<\/BODY><\/HTML>\r\n"
     */
    enterBody(body) {
        this.stringBuilder.push(body.replaceAll("\r", "\\r").replaceAll("\n", "\\n"));
    }

}
