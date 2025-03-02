document.addEventListener('DOMContentLoaded', () => {
    // Trigger animation on page load
    const blueStripes = document.querySelector('.blue-stripes');
    if (blueStripes) {
        setTimeout(() => {
            blueStripes.style.display = 'block'; // Sudden appearance
        }, 3000); // Matches the 3-second zoom-out timing
    }

    // Check if current page is index.html before running hand detection
    if (window.location.pathname.includes('index.html')) {
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const learnIslBtn = document.getElementById('learn-isl-btn');
        const detectedText = document.getElementById('detected-text');
        const translatedText = document.getElementById('translated-text');
        const translationLanguage = document.getElementById('translation-language');
        const languageSelect = document.getElementById('language-select');
        const translateBtn = document.getElementById('translate-btn');
        const readoutBtn = document.getElementById('readout-btn');

        // Check for missing DOM elements
        if (!video || !canvas || !startBtn || !stopBtn || !learnIslBtn || !detectedText || !translatedText || !languageSelect || !translateBtn || !readoutBtn || !translationLanguage) {
            console.error("Missing DOM elements:", { video, canvas, startBtn, stopBtn, learnIslBtn, detectedText, translatedText, languageSelect, translateBtn, readoutBtn, translationLanguage });
            alert("Error: Required HTML elements not found. Please check your HTML structure.");
            return; // Exit if elements are missing to prevent errors
        }

        const ctx = canvas.getContext('2d');
        let hands;
        let isDetecting = false;
        let animationFrameId;
        let handResults = null;

        // Set initial translation language to English (source language)
        translationLanguage.textContent = "Language: English";
        translatedText.textContent = ""; // Start with no translation

        // Add event listener to update translation when language changes
        languageSelect.addEventListener('change', () => {
            const detectedGesture = detectedText.textContent;
            if (detectedGesture && detectedGesture !== "No hands detected" && detectedGesture !== "Detecting gesture...") {
                translateText(detectedGesture, languageSelect.value);
            } else {
                translatedText.textContent = "No meaningful text to translate.";
                translationLanguage.textContent = "Language: English";
            }
        });

        console.log("Checking if Hands is defined...");
        if (typeof Hands === 'undefined') {
            console.error("MediaPipe Hands library is not loaded. Please check the script tag and network connection.");
            alert("MediaPipe Hands failed to load. Please check your internet connection and browser compatibility (use Chrome or Edge).");
            return;
        } else {
            console.log("Initializing MediaPipe Hands...");
            try {
                hands = new Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
                });
                hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 0,
                    minDetectionConfidence: 0.1,
                    minTrackingConfidence: 0.1,
                    selfieMode: false
                });
                hands.onResults(onHandResults);
                console.log("MediaPipe Hands initialized successfully.");
            } catch (err) {
                console.error("Failed to initialize MediaPipe Hands:", err);
                alert("Failed to initialize MediaPipe Hands: " + err.message + ". Please try a different browser (Chrome or Edge) or check your network connection.");
                return;
            }
        }

        async function startVideo() {
            console.log("Starting video...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                console.log("Webcam stream accessed successfully.");
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    console.log("Video metadata loaded, playing video...");
                    video.play().catch(err => console.error("Error playing video:", err));
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    console.log("Canvas size set:", canvas.width, "x", canvas.height);
                    isDetecting = true;
                    detectFrame();
                    if (startBtn) startBtn.disabled = true;
                    if (stopBtn) stopBtn.disabled = false;
                };
            } catch (err) {
                console.error("Error accessing webcam:", err);
                alert("Error: Webcam access denied or unavailable - " + err.message);
            }
        }

        function onHandResults(results) {
            console.log("Hand detection results:", results.multiHandLandmarks ? results.multiHandLandmarks.length : 0, "hands detected");
            handResults = results;
        }

        function drawLandmarks(landmarks) {
            console.log("Drawing landmarks...");
            ctx.beginPath();
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 2;
            for (let i = 0; i < landmarks.length; i++) {
                const x = (1 - landmarks[i].x) * canvas.width;
                const y = landmarks[i].y * canvas.height;
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = "#FF0000";
                ctx.fill();
                if (i > 0) {
                    const prevX = (1 - landmarks[i - 1].x) * canvas.width;
                    const prevY = landmarks[i - 1].y * canvas.height;
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }
            }
        }

        function detectGesture(handLandmarks) {
            console.log("Detecting gesture...");
            if (!handLandmarks || handLandmarks.length === 0) {
                console.log("No hand landmarks detected.");
                return null;
            }

            const hand = handLandmarks[0];
            const hand2 = handLandmarks.length > 1 ? handLandmarks[1] : null;

            const getDistance = (landmark1, landmark2) => {
                return Math.sqrt(
                    Math.pow(landmark1.x - landmark2.x, 2) +
                    Math.pow(landmark1.y - landmark2.y, 2)
                );
            };

            const scoreDistance = (actualDist, targetDist, maxAllowedDeviation) => {
                const deviation = Math.abs(actualDist - targetDist);
                if (deviation > maxAllowedDeviation) return 0;
                return 1 - (deviation / maxAllowedDeviation);
            };

            const scoreFingerExtended = (tip, mcp, threshold = 0.18) => {
                const dist = getDistance(tip, mcp);
                return scoreDistance(dist, threshold, threshold * 0.6);
            };

            const scoreFingerFolded = (tip, mcp, threshold = 0.10) => {
                const dist = getDistance(tip, mcp);
                return scoreDistance(dist, 0, threshold);
            };

            const wrist = hand[0];
            const thumbTip = hand[4];
            const indexTip = hand[8];
            const middleTip = hand[12];
            const ringTip = hand[16];
            const pinkyTip = hand[20];
            const thumbMCP = hand[2];
            const indexMCP = hand[5];
            const middleMCP = hand[9];
            const ringMCP = hand[13];
            const pinkyMCP = hand[17];
            const indexPIP = hand[6];
            const middlePIP = hand[10];
            const ringPIP = hand[14];
            const pinkyPIP = hand[18];

            const wrist2 = hand2 ? hand2[0] : null;
            const thumbTip2 = hand2 ? hand2[4] : null;
            const indexTip2 = hand2 ? hand2[8] : null;
            const middleTip2 = hand2 ? hand2[12] : null;
            const ringTip2 = hand2 ? hand2[16] : null;
            const pinkyTip2 = hand2 ? hand2[20] : null;
            const indexMCP2 = hand2 ? hand2[5] : null;
            const middleMCP2 = hand2 ? hand2[9] : null;
            const ringMCP2 = hand2 ? hand2[13] : null;
            const pinkyMCP2 = hand2 ? hand2[17] : null;

            const gestures = [];
            const scoreThreshold = 0.1; // Low threshold for higher sensitivity and easy detection

            // Define scoring for all 26 alphabet gestures (A–Z) using simplified ISL hand shapes
            const alphabetScores = {
                'A': scoreFingerFolded(indexTip, indexMCP) * 0.25 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'B': scoreFingerExtended(indexTip, indexMCP) * 0.2 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.2 +
                     scoreFingerExtended(ringTip, ringMCP) * 0.2 +
                     scoreFingerExtended(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerFolded(thumbTip, thumbMCP) * 0.2,
                'C': scoreFingerFolded(indexTip, indexMCP) * 0.25 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'D': scoreFingerExtended(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'E': scoreFingerFolded(indexTip, indexMCP) * 0.2 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.2,
                'F': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'G': scoreFingerExtended(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerFolded(thumbTip, thumbMCP) * 0.1,
                'H': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'I': scoreFingerFolded(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'J': scoreFingerExtended(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'K': scoreFingerExtended(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'L': scoreFingerExtended(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'M': scoreFingerFolded(indexTip, indexMCP) * 0.25 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'N': scoreFingerFolded(indexTip, indexMCP) * 0.25 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'O': scoreFingerFolded(indexTip, indexMCP) * 0.25 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'P': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'Q': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'R': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'S': scoreFingerFolded(indexTip, indexMCP) * 0.25 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'T': scoreFingerFolded(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'U': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'V': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'W': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerExtended(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25,
                'X': scoreFingerFolded(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'Y': scoreFingerExtended(indexTip, indexMCP) * 0.3 +
                     scoreFingerFolded(middleTip, middleMCP) * 0.2 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.2 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2 +
                     scoreFingerExtended(thumbTip, thumbMCP) * 0.1,
                'Z': scoreFingerExtended(indexTip, indexMCP) * 0.25 +
                     scoreFingerExtended(middleTip, middleMCP) * 0.25 +
                     scoreFingerFolded(ringTip, ringMCP) * 0.25 +
                     scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25
            };

            // Check each alphabet score and add to gestures if above threshold
            for (const [letter, score] of Object.entries(alphabetScores)) {
                if (score > scoreThreshold) {
                    gestures.push({ name: letter, score: score });
                }
            }

            // Define scoring for 10 simple, easily detectable ISL words/phrases
            let scoreHello1 = 0;
            scoreHello1 += scoreFingerExtended(indexTip, indexMCP) * 0.15;
            scoreHello1 += scoreFingerExtended(middleTip, middleMCP) * 0.15;
            scoreHello1 += scoreFingerExtended(ringTip, ringMCP) * 0.15;
            scoreHello1 += scoreFingerExtended(pinkyTip, pinkyMCP) * 0.15;
            scoreHello1 += scoreDistance(getDistance(indexTip, middleTip), 0.18, 0.12) * 0.1;
            scoreHello1 += scoreDistance(getDistance(middleTip, ringTip), 0.18, 0.12) * 0.1;
            if (hand2) {
                let scoreHello2 = 0;
                scoreHello2 += scoreFingerExtended(indexTip2, indexMCP2) * 0.15;
                scoreHello2 += scoreFingerExtended(middleTip2, middleMCP2) * 0.15;
                scoreHello2 += scoreFingerExtended(ringTip2, ringMCP2) * 0.15;
                scoreHello2 += scoreFingerExtended(pinkyTip2, pinkyMCP2) * 0.15;
                scoreHello2 += scoreDistance(getDistance(indexTip2, middleTip2), 0.18, 0.12) * 0.1;
                scoreHello2 += scoreDistance(getDistance(middleTip2, ringTip2), 0.18, 0.12) * 0.1;
                const combinedScoreHello = (scoreHello1 + scoreHello2) / 2;
                if (combinedScoreHello > scoreThreshold) gestures.push({ name: "Hello", score: combinedScoreHello });
            } else {
                if (scoreHello1 > scoreThreshold) gestures.push({ name: "Hello", score: scoreHello1 });
            }

            let scoreGoodbye = 0;
            scoreGoodbye += scoreFingerExtended(indexTip, indexMCP) * 0.15;
            scoreGoodbye += scoreFingerExtended(middleTip, middleMCP) * 0.15;
            scoreGoodbye += scoreFingerExtended(ringTip, ringMCP) * 0.15;
            scoreGoodbye += scoreFingerExtended(pinkyTip, pinkyMCP) * 0.15;
            scoreGoodbye += scoreDistance(getDistance(indexTip, middleTip), 0, 0.10) * 0.1;
            scoreGoodbye += scoreDistance(getDistance(middleTip, ringTip), 0, 0.10) * 0.1;
            if (scoreGoodbye > scoreThreshold) gestures.push({ name: "Goodbye", score: scoreGoodbye });

            let scoreYes = 0;
            scoreYes += scoreFingerFolded(indexTip, indexMCP) * 0.15;
            scoreYes += scoreFingerFolded(middleTip, middleMCP) * 0.15;
            scoreYes += scoreFingerFolded(ringTip, ringMCP) * 0.15;
            scoreYes += scoreFingerFolded(pinkyTip, pinkyMCP) * 0.15;
            scoreYes += scoreFingerExtended(thumbTip, thumbMCP) * 0.15;
            if (scoreYes > scoreThreshold) gestures.push({ name: "Yes", score: scoreYes });

            let scoreNo = 0;
            scoreNo += scoreFingerExtended(indexTip, indexMCP) * 0.2;
            scoreNo += scoreFingerExtended(middleTip, middleMCP) * 0.2;
            scoreNo += scoreFingerExtended(ringTip, ringMCP) * 0.2;
            scoreNo += scoreFingerExtended(pinkyTip, pinkyMCP) * 0.2;
            scoreNo += scoreFingerFolded(thumbTip, thumbMCP) * 0.2;
            if (scoreNo > scoreThreshold) gestures.push({ name: "No", score: scoreNo });

            let scorePlease = 0;
            scorePlease += scoreFingerExtended(indexTip, indexMCP) * 0.25;
            scorePlease += scoreFingerExtended(middleTip, middleMCP) * 0.25;
            scorePlease += scoreFingerFolded(ringTip, ringMCP) * 0.25;
            scorePlease += scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25;
            if (scorePlease > scoreThreshold) gestures.push({ name: "Please", score: scorePlease });

            let scoreThankYou = 0;
            scoreThankYou += scoreFingerExtended(indexTip, indexMCP) * 0.2;
            scoreThankYou += scoreFingerExtended(middleTip, middleMCP) * 0.2;
            scoreThankYou += scoreFingerExtended(ringTip, ringMCP) * 0.2;
            scoreThankYou += scoreFingerExtended(pinkyTip, pinkyMCP) * 0.2;
            scoreThankYou += scoreFingerExtended(thumbTip, thumbMCP) * 0.2;
            if (scoreThankYou > scoreThreshold) gestures.push({ name: "Thank You", score: scoreThankYou });

            let scoreSorry = 0;
            scoreSorry += scoreFingerFolded(indexTip, indexMCP) * 0.2;
            scoreSorry += scoreFingerFolded(middleTip, middleMCP) * 0.2;
            scoreSorry += scoreFingerFolded(ringTip, ringMCP) * 0.2;
            scoreSorry += scoreFingerFolded(pinkyTip, pinkyMCP) * 0.2;
            scoreSorry += scoreFingerExtended(thumbTip, thumbMCP) * 0.2;
            if (scoreSorry > scoreThreshold) gestures.push({ name: "Sorry", score: scoreSorry });

            let scoreLove = 0;
            scoreLove += scoreFingerExtended(indexTip, indexMCP) * 0.25;
            scoreLove += scoreFingerExtended(middleTip, middleMCP) * 0.25;
            scoreLove += scoreFingerFolded(ringTip, ringMCP) * 0.25;
            scoreLove += scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25;
            if (scoreLove > scoreThreshold) gestures.push({ name: "Love", score: scoreLove });

            let scoreHelp = 0;
            scoreHelp += scoreFingerExtended(indexTip, indexMCP) * 0.2;
            scoreHelp += scoreFingerExtended(middleTip, middleMCP) * 0.2;
            scoreHelp += scoreFingerExtended(ringTip, ringMCP) * 0.2;
            scoreHelp += scoreFingerExtended(pinkyTip, pinkyMCP) * 0.2;
            scoreHelp += scoreFingerExtended(thumbTip, thumbMCP) * 0.2;
            if (scoreHelp > scoreThreshold) gestures.push({ name: "Help", score: scoreHelp });

            let scoreStop = 0;
            scoreStop += scoreFingerFolded(indexTip, indexMCP) * 0.25;
            scoreStop += scoreFingerFolded(middleTip, middleMCP) * 0.25;
            scoreStop += scoreFingerFolded(ringTip, ringMCP) * 0.25;
            scoreStop += scoreFingerFolded(pinkyTip, pinkyMCP) * 0.25;
            if (scoreStop > scoreThreshold) gestures.push({ name: "Stop", score: scoreStop });

            if (gestures.length > 0) {
                gestures.sort((a, b) => b.score - a.score);
                console.log("Detected gestures:", gestures);
                return gestures[0].name; // Returns just the single character for alphabets (e.g., "A") or full word (e.g., "Hello")
            }

            return null;
        }

        async function detectFrame() {
            if (!isDetecting) return;

            console.log("Processing frame...");
            try {
                if (!hands) {
                    throw new Error("MediaPipe Hands is not initialized.");
                }
                await hands.send({ image: video }).catch(err => {
                    console.error("Hand detection failed:", err);
                    throw err;
                });
            } catch (err) {
                console.error("Error in detection frame:", err);
                stopDetection();
                alert("Detection error: " + err.message + ". Please try a different browser (Chrome or Edge) or check your network connection.");
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            if (handResults && handResults.multiHandLandmarks) {
                console.log("Drawing hand landmarks...");
                for (const landmarks of handResults.multiHandLandmarks) {
                    drawLandmarks(landmarks);
                }
                const detectedGesture = detectGesture(handResults.multiHandLandmarks);
                detectedText.textContent = detectedGesture || "Detecting gesture...";
                if (detectedGesture && detectedGesture !== "Detecting gesture...") {
                    translateText(detectedGesture, languageSelect.value); // Live translate on gesture detection
                } else {
                    translatedText.textContent = "No meaningful text to translate.";
                    translationLanguage.textContent = "Language: English";
                }
            } else {
                console.log("No hands detected in this frame.");
                detectedText.textContent = "No hands detected";
                translatedText.textContent = "No meaningful text to translate.";
                translationLanguage.textContent = "Language: English";
            }

            requestAnimationFrame(detectFrame);
        }

        function stopDetection() {
            isDetecting = false;
            cancelAnimationFrame(animationFrameId);
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
                video.srcObject = null;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            detectedText.textContent = "No gestures detected yet...";
            translatedText.textContent = "No meaningful text to translate.";
            translationLanguage.textContent = "Language: English";
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
        }

        function speakText(text) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'en-US';
                utterance.rate = 1.0;
                speechSynthesis.speak(utterance);
            } else {
                alert("Sorry, your browser does not support the Web Speech API.");
            }
        }

        async function translateText(text, targetLang) {
            if (!text || text === "No hands detected" || text === "Detecting gesture...") {
                translatedText.textContent = "No meaningful text to translate.";
                translationLanguage.textContent = "Language: English";
                return;
            }

            try {
                console.log("Translating:", text, "to", targetLang);
                const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
                const data = await response.json();
                if (data && data[0] && data[0][0] && data[0][0][0]) {
                    translatedText.textContent = data[0][0][0];
                    const languageNames = {
                        "hi": "Hindi",
                        "es": "Spanish",
                        "fr": "French",
                        "de": "German",
                        "ta": "Tamil",
                        "te": "Telugu",
                        "bn": "Bengali",
                        "gu": "Gujarati",
                        "mr": "Marathi",
                        "kn": "Kannada"
                    };
                    translationLanguage.textContent = `Language: ${languageNames[targetLang] || "Unknown"}`;
                } else {
                    translatedText.textContent = "Translation error: Unable to translate.";
                    translationLanguage.textContent = "Language: English";
                }
            } catch (err) {
                console.error("Translation error:", err);
                translatedText.textContent = "Translation error: " + err.message;
                translationLanguage.textContent = "Language: English";
            }
        }

        // Ensure buttons are properly attached and functional
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                startVideo();
            });
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                stopDetection();
            });
        }
        if (learnIslBtn) {
            learnIslBtn.addEventListener('click', () => {
                window.location.href = 'learn-isl.html';
            });
        }
        if (readoutBtn) {
            readoutBtn.addEventListener('click', () => {
                const textToRead = detectedText.textContent;
                if (textToRead && textToRead !== "No hands detected" && textToRead !== "Detecting gesture...") {
                    speakText(textToRead);
                } else {
                    speakText("No meaningful gesture detected to read out.");
                }
            });
        }
        // Translate button is hidden, but included for completeness
        if (translateBtn) {
            translateBtn.style.display = 'none';
        }
    }
});