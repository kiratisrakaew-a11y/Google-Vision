/**
 * OCR via Google Cloud Vision (DOCUMENT_TEXT_DETECTION).
 * Reads Thai/English text from images and PDFs. Uses the deployer's OAuth
 * token (cloud-platform scope) — no API key. Requires the Cloud Vision API
 * to be enabled in the project.
 */

function ocrWithVision_(blob) {
  var mimeType = blob.getContentType();
  var content = Utilities.base64Encode(blob.getBytes());
  var languageHints = CONFIG.OCR_LANGUAGE_HINTS || [];
  var isPdf = mimeType === 'application/pdf';

  var endpoint = isPdf
    ? 'https://vision.googleapis.com/v1/files:annotate'
    : 'https://vision.googleapis.com/v1/images:annotate';

  var request = isPdf
    ? {
        requests: [{
          inputConfig: { content: content, mimeType: mimeType },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: languageHints }
        }]
      }
    : {
        requests: [{
          image: { content: content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: languageHints }
        }]
      };

  var response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Goog-User-Project': CONFIG.PROJECT_ID
    },
    payload: JSON.stringify(request),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('Vision API error ' + status + ': ' + body);
  }

  var parsed = JSON.parse(body);
  return {
    text: extractVisionText_(parsed, isPdf),
    response: parsed
  };
}

function extractVisionText_(parsed, isPdf) {
  var responses = parsed.responses || [];
  if (!responses.length) {
    return '';
  }

  if (isPdf) {
    // files:annotate -> responses[0].responses[] is one AnnotateImageResponse per page.
    var fileResponse = responses[0] || {};
    if (fileResponse.error) {
      throw new Error('Vision API error: ' + JSON.stringify(fileResponse.error));
    }

    var pages = fileResponse.responses || [];
    var texts = [];
    pages.forEach(function (page) {
      if (page.fullTextAnnotation && page.fullTextAnnotation.text) {
        texts.push(page.fullTextAnnotation.text);
      }
    });
    return texts.join('\n');
  }

  // images:annotate -> responses[0].fullTextAnnotation.text
  var imageResponse = responses[0] || {};
  if (imageResponse.error) {
    throw new Error('Vision API error: ' + JSON.stringify(imageResponse.error));
  }

  return imageResponse.fullTextAnnotation && imageResponse.fullTextAnnotation.text
    ? imageResponse.fullTextAnnotation.text
    : '';
}
