const providerInput =
    document.getElementById("provider");

const apiKeyInput =
    document.getElementById("apiKey");

const toggleKeyButton =
    document.getElementById("toggleKey");

const testButton =
    document.getElementById("testButton");

const timeline =
    document.getElementById("timeline");

const timelineCard =
    document.getElementById("timelineCard");

const resultCard =
    document.getElementById("resultCard");

const statusElement =
    document.getElementById("status");

const diagnosisElement =
    document.getElementById("diagnosis");

const diagnosisDescription =
    document.getElementById("diagnosisDescription");

const latencyElement =
    document.getElementById("latency");

const attemptsElement =
    document.getElementById("attempts");

const resultIndicator =
    document.getElementById("resultIndicator");

const timelineStatus =
    document.getElementById("timelineStatus");

const retryPanel =
    document.getElementById("retryPanel");

const retryMessage =
    document.getElementById("retryMessage");

const retryCountdown =
    document.getElementById("retryCountdown");


const API_BASE_URL =
    "https://apilensserver.onrender.com";


const STREAM_DELAY = {
    provider_detected: 420,
    request_started: 480,
    response_received: 550,
    headers_analyzed: 450,
    retry_started: 500,
    retry_countdown: 120,
    retry_completed: 500,
    diagnosis: 650,
    completed: 750
};


/* =========================
   CUSTOM PROVIDER DROPDOWN
   ========================= */

const providerSelect =
    document.getElementById("providerSelect");

const providerTrigger =
    document.getElementById("providerTrigger");

const providerMenu =
    document.getElementById("providerMenu");

const providerSelected =
    document.getElementById("providerSelected");

const providerOptions =
    document.querySelectorAll(".custom-option");


providerTrigger.addEventListener("click", (event) => {
    event.stopPropagation();

    providerSelect.classList.toggle("open");
});

providerOptions.forEach((option) => {
    option.addEventListener("click", () => {

        const value = option.dataset.value;
        const label = option.textContent.trim();

        providerInput.value = value;
        providerSelected.textContent = label;

        providerOptions.forEach((item) => {
            item.classList.remove("active");
        });

        option.classList.add("active");

        providerSelect.classList.remove("open");
    });
});

document.addEventListener("click", (event) => {
    if (!providerSelect.contains(event.target)) {
        providerSelect.classList.remove("open");
    }
});


const diagnosisDescriptions = {

    OK:
        "The provider accepted the credential successfully.",

    AUTH_INVALID:
        "The provider rejected the supplied API key.",

    AUTH_MISSING:
        "Authentication information was not supplied correctly.",

    AUTH_EXPIRED:
        "The provider indicates that the credential has expired.",

    PERMISSION_DENIED:
        "The credential is recognized but does not have permission for this operation.",

    QUOTA_DAILY:
        "The available daily quota appears to be exhausted.",

    QUOTA_TOKEN:
        "The token quota appears to have been exceeded.",

    RL_RPM:
        "The request rate limit was reached.",

    RL_TPM:
        "The token rate limit was reached.",

    BILLING_EXHAUSTED:
        "Billing, credits, or spending limits appear to be exhausted.",

    MODEL_UNAVAILABLE:
        "The requested model is unavailable or cannot be accessed.",

    PROVIDER_5XX:
        "The provider returned a temporary server-side error.",

    NETWORK_ERROR:
        "The diagnostic request could not reach the provider.",

    TIMEOUT:
        "The provider did not respond within the allowed time.",

    UNKNOWN_ERROR:
        "The provider returned an error that could not be classified."
};


function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


function setResultState(state) {

    resultIndicator.className =
        `result-indicator ${state}`;

    const label =
        resultIndicator.querySelector("label");

    const labels = {
        idle: "Waiting",
        running: "Running",
        success: "Healthy",
        error: "Issue detected"
    };

    label.textContent =
        labels[state] || "Waiting";
}


function resetResult() {

    timeline.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">◌</div>

            <div>
                <strong>
                    Starting diagnostic...
                </strong>

                <span>
                    Connecting to provider.
                </span>
            </div>
        </div>
    `;

    statusElement.textContent = "—";

    diagnosisElement.textContent =
        "Analyzing...";

    diagnosisDescription.textContent =
        "Waiting for diagnostic response.";

    latencyElement.textContent = "—";

    attemptsElement.textContent = "—";

    retryPanel.classList.add("hidden");

    if (activeRetryInterval) {
    clearInterval(activeRetryInterval);
    activeRetryInterval = null;
}

    retryMessage.textContent = "—";

    retryCountdown.textContent = "";

    resultCard.classList.remove("active");

    setResultState("running");

    timelineStatus.textContent =
        "RUNNING";
}


function clearEmptyState() {

    const emptyState =
        timeline.querySelector(".empty-state");

    if (emptyState) {
        emptyState.remove();
    }
}


function getEventState(event) {
    if (!event) {
        return "processing";
    }

    if (event.event === "error") {
        return "error";
    }

    if (event.event === "diagnosis") {
        const severity = event.data?.severity;

        if (severity === "error") {
            return "error";
        }

        if (severity === "warning") {
            return "warning";
        }

        return "success";
    }

    if (event.event === "completed") {
        return event.data?.code === "OK"
            ? "success"
            : "error";
    }

    if (
        event.event === "retry_started" ||
        event.event === "retry_countdown"
    ) {
        return "warning";
    }

    return "processing";
}


function getEventKey(event) {
    return [
        event?.event || "event",
        event?.data?.attempt ?? "",
        event?.data?.code ?? ""
    ].join("-");
}


function scrollTimelineToBottom() {
    requestAnimationFrame(() => {
        timeline.scrollTo({
            top: timeline.scrollHeight,
            behavior: "smooth"
        });
    });
}


function finishTimelineEvent(item, state) {
    if (!item) return;

    item.classList.remove(
        "processing",
        "success",
        "warning",
        "error"
    );

    item.classList.add(state);

    const marker = item.querySelector(".event-marker");

    if (marker) {
        marker.classList.remove(
            "processing",
            "success",
            "warning",
            "error"
        );

        marker.classList.add(state);

        /* Make absolutely sure no old animation survives */
        marker.style.animation = "none";
        marker.style.transform = "none";
    }
}


function addTimelineEvent(event) {
    clearEmptyState();

    const key = getEventKey(event);
    const state = getEventState(event);

    /*
        Some events describe the same diagnostic stage.
        Update the existing row instead of creating
        unnecessary duplicates.
    */
    const existing =
        Array.from(
            timeline.querySelectorAll(
                ".timeline-event"
            )
        ).find(
            item =>
                item.dataset.eventKey === key
        );

    if (existing) {
        finishTimelineEvent(
            existing,
            state
        );

        const message =
            existing.querySelector(
                ".event-message"
            );

        if (message && event.message) {
            message.textContent =
                event.message;
        }

        scrollTimelineToBottom();

        return existing;
    }


    const item =
        document.createElement("div");

    item.className =
        `timeline-event ${state}`;

    item.dataset.eventKey =
        key;


    const marker =
        document.createElement("div");

    marker.className =
        `event-marker ${state}`;


    const content =
        document.createElement("div");

    content.className =
        "event-content";


    const message =
        document.createElement("div");

    message.className =
        "event-message";

    message.textContent =
        event.message ||
        event.event ||
        "Processing...";


    const type =
        document.createElement("div");

    type.className =
        "event-type";

    type.textContent =
        event.event ||
        "event";


    content.appendChild(message);
    content.appendChild(type);

    item.appendChild(marker);
    item.appendChild(content);

    timeline.appendChild(item);


    /*
        Processing events stay alive visually.
        CSS displays the spinner inside the marker.
    */
    if (state === "processing") {
        item.classList.add("processing");
        marker.classList.add("processing");
    } else {
        finishTimelineEvent(
            item,
            state
        );
    }


    scrollTimelineToBottom();

    return item;
}


async function revealEvent(event) {
    const delay =
        STREAM_DELAY[event.event] ?? 450;

    await sleep(delay);

    handleEvent(event);
}


let activeRetryInterval = null;


function showRetryGuidance(data) {
    if (!data) {
        return;
    }

    const retrySeconds =
        data.retry_after_seconds;

    if (
        retrySeconds === null ||
        retrySeconds === undefined
    ) {
        return;
    }

    retryPanel.classList.remove(
        "hidden"
    );


    if (data.retry_source === "provider") {
        retryMessage.textContent =
            "The provider supplied an exact retry time.";
    } else {
        retryMessage.textContent =
            "Controlled diagnostic backoff is being used.";
    }


    startRetryCountdown(
        Number(retrySeconds)
    );
}


function startRetryCountdown(seconds) {
    if (!Number.isFinite(seconds)) {
        return;
    }


    if (activeRetryInterval) {
        clearInterval(
            activeRetryInterval
        );

        activeRetryInterval = null;
    }


    let remaining =
        Math.max(
            0,
            Math.ceil(seconds)
        );


    retryCountdown.textContent =
        `${remaining}s`;


    if (remaining <= 0) {
        retryCountdown.textContent =
            "READY";

        return;
    }


    activeRetryInterval =
        setInterval(() => {

            remaining -= 1;


            if (remaining <= 0) {
                clearInterval(
                    activeRetryInterval
                );

                activeRetryInterval =
                    null;

                retryCountdown.textContent =
                    "READY";

                return;
            }


            retryCountdown.textContent =
                `${remaining}s`;

        }, 1000);
}


function handleEvent(event) {
    addTimelineEvent(event);

    const data =
        event.data || {};


    if (event.event === "provider_detected") {
        timelineStatus.textContent =
            "DETECTED";
    }


    if (event.event === "request_started") {
        timelineStatus.textContent =
            "TESTING";
    }


    if (event.event === "response_received") {

        statusElement.textContent =
            data.status_code ?? "—";


        latencyElement.textContent =
            data.latency_ms != null
                ? `${Number(
                    data.latency_ms
                ).toFixed(2)} ms`
                : "—";
    }


    if (event.event === "headers_analyzed") {
        timelineStatus.textContent =
            "ANALYZED";
    }


    if (event.event === "retry_started") {

        timelineStatus.textContent =
            "RETRYING";

        showRetryGuidance(data);
    }


    if (event.event === "retry_countdown") {

        timelineStatus.textContent =
            data.remaining_seconds != null
                ? `RETRY IN ${data.remaining_seconds}s`
                : "RETRYING";


        if (
            data.remaining_seconds !==
            undefined &&
            data.remaining_seconds !==
            null
        ) {

            retryPanel.classList.remove(
                "hidden"
            );


            retryMessage.textContent =
                "Diagnostic retry scheduled.";


            retryCountdown.textContent =
                `${data.remaining_seconds}s`;
        }
    }


    if (event.event === "retry_completed") {

        timelineStatus.textContent =
            "RETRY COMPLETE";


        if (data.status_code != null) {
            statusElement.textContent =
                data.status_code;
        }


        if (data.latency_ms != null) {
            latencyElement.textContent =
                `${Number(
                    data.latency_ms
                ).toFixed(2)} ms`;
        }
    }


    if (event.event === "diagnosis") {

        const code =
            data.code ||
            "UNKNOWN_ERROR";


        diagnosisElement.textContent =
            code;


        diagnosisDescription.textContent =
            data.message ||
            diagnosisDescriptions[code] ||
            "The diagnostic engine completed its analysis.";


        if (
            data.retry_after_seconds !==
            null &&
            data.retry_after_seconds !==
            undefined
        ) {
            showRetryGuidance(data);
        }


        if (data.severity === "error") {

            setResultState(
                "error"
            );

        } else if (code === "OK") {

            setResultState(
                "success"
            );

        } else {

            setResultState(
                "running"
            );
        }
    }


    if (event.event === "completed") {

        timelineStatus.textContent =
            "COMPLETE";


        if (data.code === "OK") {

            setResultState(
                "success"
            );

        } else {

            setResultState(
                "error"
            );
        }


        if (data.attempts != null) {
            attemptsElement.textContent =
                data.attempts;
        }


        resultCard.classList.add(
            "active"
        );


        setTimeout(() => {

            resultCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

        }, 650);
    }


    if (event.event === "error") {

        setResultState(
            "error"
        );


        timelineStatus.textContent =
            "ERROR";


        diagnosisElement.textContent =
            "DIAGNOSTIC_ERROR";


        diagnosisDescription.textContent =
            event.message ||
            "The diagnostic request failed.";


        resultCard.classList.add(
            "active"
        );


        setTimeout(() => {

            resultCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

        }, 400);
    }
}


async function consumeSSE(response) {

    if (!response.body) {

        throw new Error(
            "Streaming response is unavailable."
        );
    }


    const reader =
        response.body.getReader();

    const decoder =
        new TextDecoder();

    let buffer = "";


    while (true) {

        const {
            value,
            done
        } = await reader.read();


        if (done) {
            break;
        }


        buffer += decoder.decode(
            value,
            { stream: true }
        );


        const chunks =
            buffer.split("\n\n");


        buffer =
            chunks.pop() || "";


        for (const chunk of chunks) {

            const lines =
                chunk.split("\n");


            const dataLine =
                lines.find(
                    line =>
                        line.startsWith("data:")
                );


            if (!dataLine) {
                continue;
            }


            const jsonText =
                dataLine
                    .replace(/^data:\s*/, "")
                    .trim();


            if (!jsonText) {
                continue;
            }


            try {

                const event =
                    JSON.parse(jsonText);

                await revealEvent(event);

            } catch (error) {

                console.error(
                    "Invalid SSE event:",
                    error
                );
            }
        }
    }
}


async function testApiKey() {

    const provider =
        providerInput.value;

    const apiKey =
        apiKeyInput.value.trim();


    if (!apiKey) {

        apiKeyInput.focus();

        apiKeyInput.parentElement.style.borderColor =
            "rgba(255, 116, 116, 0.55)";


        setTimeout(() => {

            apiKeyInput.parentElement.style.borderColor =
                "";

        }, 1200);

        return;
    }


    resetResult();


    testButton.disabled = true;


    const buttonText =
        testButton.querySelector(
            ".button-text"
        );


    buttonText.textContent =
        "Running diagnostic...";


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/test/stream`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        provider,
                        api_key: apiKey
                    })
                }
            );


        if (!response.ok) {

            let message =
                `Request failed with HTTP ${response.status}`;


            try {

                const errorData =
                    await response.json();

                if (errorData.error) {
                    message =
                        errorData.error;
                }

            } catch {
                // Ignore invalid error body.
            }


            throw new Error(message);
        }


        await consumeSSE(response);


        attemptsElement.textContent =
            "Complete";


    } catch (error) {

        console.error(error);


        addTimelineEvent({
            event: "error",
            message: error.message,
            data: {}
        });


        setResultState("error");

        timelineStatus.textContent =
            "ERROR";


    } finally {

        testButton.disabled = false;

        buttonText.textContent =
            "Run diagnostic";
    }
}


toggleKeyButton.addEventListener(
    "click",
    () => {

        const isPassword =
            apiKeyInput.type === "password";


        apiKeyInput.type =
            isPassword
                ? "text"
                : "password";


        toggleKeyButton.textContent =
            isPassword
                ? "Hide"
                : "Show";
    }
);


testButton.addEventListener(
    "click",
    testApiKey
);


apiKeyInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !testButton.disabled
        ) {
            testApiKey();
        }
    }
);
