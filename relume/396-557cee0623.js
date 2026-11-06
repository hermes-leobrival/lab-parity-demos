(self.URL || self.webkitURL).revokeObjectURL(self.location.href);(function() {
	//#region ../../../../../../setup-pnpm/node_modules/.bin/store/v11/links/@/base64-arraybuffer/1.0.2/f63fa6b5c318cf1c9f6bdd1d4292ad2f15f76f2ec78475025a2d44070e896fe9/node_modules/base64-arraybuffer/dist/base64-arraybuffer.es5.js
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var lookup = typeof Uint8Array === "undefined" ? [] : /* @__PURE__ */ new Uint8Array(256);
	for (var i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
	var encode = function(arraybuffer) {
		var bytes = new Uint8Array(arraybuffer), i, len = bytes.length, base64 = "";
		for (i = 0; i < len; i += 3) {
			base64 += chars[bytes[i] >> 2];
			base64 += chars[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
			base64 += chars[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
			base64 += chars[bytes[i + 2] & 63];
		}
		if (len % 3 === 2) base64 = base64.substring(0, base64.length - 1) + "=";
		else if (len % 3 === 1) base64 = base64.substring(0, base64.length - 2) + "==";
		return base64;
	};
	//#endregion
	//#region ../rrweb/src/record/workers/image-bitmap-data-url-worker.ts
	const lastFingerprintMap = /* @__PURE__ */ new Map();
	const transparentFingerprintMap = /* @__PURE__ */ new Map();
	const lastSentAtMap = /* @__PURE__ */ new Map();
	const PROVIDER_KEYFRAME_INTERVAL_MS = 3e4;
	function hashPixels(data) {
		const view = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >>> 2);
		let primaryHash = 2166136261;
		let secondaryHash = 2654435769;
		for (let i = 0; i < view.length; i++) {
			primaryHash ^= view[i];
			primaryHash = Math.imul(primaryHash, 16777619);
			secondaryHash ^= view[i];
			secondaryHash = Math.imul(secondaryHash, 2246822507);
		}
		return `${(primaryHash >>> 0).toString(16)}:${(secondaryHash >>> 0).toString(16)}`;
	}
	function frameFingerprint(width, height, data) {
		return `${width}x${height}:${hashPixels(data)}`;
	}
	function transparentFingerprint(width, height) {
		const pixelCount = width * height;
		let hash = transparentFingerprintMap.get(pixelCount);
		if (hash === void 0) {
			hash = hashPixels(new Uint8ClampedArray(pixelCount * 4));
			transparentFingerprintMap.set(pixelCount, hash);
		}
		return `${width}x${height}:${hash}`;
	}
	const worker = self;
	let reusableCanvas = null;
	let reusableCtx = null;
	worker.onmessage = async function(e) {
		if ("resetFrameDedup" in e.data) {
			lastFingerprintMap.clear();
			return;
		}
		if ("OffscreenCanvas" in globalThis) {
			const { id, bitmap, width, height, displayWidth, displayHeight, dataURLOptions, maskRegions } = e.data;
			try {
				if (!reusableCanvas || reusableCanvas.width !== width || reusableCanvas.height !== height) {
					reusableCanvas = new OffscreenCanvas(width, height);
					reusableCtx = reusableCanvas.getContext("2d", { willReadFrequently: true });
				}
				const ctx = reusableCtx;
				ctx.clearRect(0, 0, width, height);
				ctx.drawImage(bitmap, 0, 0);
				bitmap.close();
				if (maskRegions) {
					ctx.fillStyle = "black";
					for (const region of maskRegions) ctx.fillRect(region.x, region.y, region.width, region.height);
				}
				const fingerprint = frameFingerprint(width, height, ctx.getImageData(0, 0, width, height).data);
				if (fingerprint === (lastFingerprintMap.get(id) ?? transparentFingerprint(width, height))) {
					const lastSentAt = lastSentAtMap.get(id);
					if (!(maskRegions !== void 0 && lastSentAt !== void 0 && Date.now() - lastSentAt >= PROVIDER_KEYFRAME_INTERVAL_MS)) return worker.postMessage({ id });
				}
				const blob = await reusableCanvas.convertToBlob(dataURLOptions);
				const arrayBuffer = await blob.arrayBuffer();
				worker.postMessage({
					id,
					type: blob.type,
					base64: encode(arrayBuffer),
					displayWidth,
					displayHeight
				});
				lastFingerprintMap.set(id, fingerprint);
				lastSentAtMap.set(id, Date.now());
			} catch {
				worker.postMessage({ id });
			}
		} else {
			e.data.bitmap.close();
			return worker.postMessage({ id: e.data.id });
		}
	};
	//#endregion
})();
