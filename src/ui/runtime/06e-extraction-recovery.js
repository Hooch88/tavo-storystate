  // A syntax repair cannot recover story facts from empty/prose/truncated output.
  // Retry the original evidence once; never consume a failed or partial batch.
  function parseCompleteRetry(raw) {
    const keys = ["npcProposals","relationshipProposals","informationProposals","knowledgeProposals","arcProposals"];
    for (const candidate of jsonObjectCandidates(dev5SanitizeExtractorOutput(raw))) {
      try {
        const parsed = JSON.parse(removeJsonTrailingCommas(candidate));
        if (parsed && keys.every(key => Array.isArray(parsed[key]))) return parseExtractionResponse(candidate);
      } catch (_) {}
    }
    throw new Error("Fresh extractor response must contain all five proposal arrays.");
  }
  async function extractScanWithRecovery(prompt, onRepair, stillOwned = () => true) {
    const options = {context:false, timeout:SCAN_EXTRACT_TIMEOUT_MS, settings:{temperature:0.1,maxCompletionTokens:5000}};
    const raw = await withTimeout(tavo.generate(prompt, options), SCAN_EXTRACT_TIMEOUT_MS, "StoryState extraction");
    if (!stillOwned()) throw new Error("Scan ownership changed; extractor result discarded.");
    try {
      return await parseExtractionWithOneRepair(raw, onRepair);
    } catch (firstError) {
      if (!stillOwned()) throw firstError;
      if (typeof onRepair === "function") onRepair("Re-extracting original story batch once");
      const retryPrompt = prompt + '\n\nRETRY: The previous response could not be read. Re-analyze the SAVED MESSAGES above. Return the five-array JSON object immediately. Keep statements brief and include only evidence-supported changes. Empty arrays are valid only when your analysis finds no meaningful changes.';
      let retryRaw;
      try {
        retryRaw = await withTimeout(tavo.generate(retryPrompt, options), SCAN_EXTRACT_TIMEOUT_MS, "StoryState extraction retry");
        if (!stillOwned()) throw new Error("Scan ownership changed; retry result discarded.");
        // No recursive repair/retry loop. A fresh valid answer may legitimately be empty.
        return {proposals:parseCompleteRetry(retryRaw), repaired:false, retried:true};
      } catch (retryError) {
        const error = new Error(`Extraction failed after one fresh attempt. ${text(retryError?.message || "Invalid model output",180)} The original batch remains unscanned.`);
        error.rawPreview = text(dev5SanitizeExtractorOutput(raw),900) || "[empty model response]";
        error.repairedPreview = firstError.repairedPreview;
        error.retryPreview = retryRaw == null ? "[request failed before output]" : (text(dev5SanitizeExtractorOutput(retryRaw),900) || "[empty model response]");
        throw error;
      }
    }
  }
