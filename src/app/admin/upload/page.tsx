"use client";

import { useState, FormEvent } from "react";

export default function UploadPage() {
  const [platform, setPlatform] = useState("android");
  const [jsVersion, setJsVersion] = useState("");
  const [bundleVersion, setBundleVersion] = useState("");
  const [description, setDescription] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a bundle file");
      return;
    }

    setUploading(true);
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress(30);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      setProgress(60);

      const appId = `investor-app-${platform}`;
      const hash = uploadData.fileId || "generated-hash";

      const releaseRes = await fetch("/api/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId,
          platform,
          jsVersion: parseInt(jsVersion, 10),
          bundleVersion: parseInt(bundleVersion, 10),
          hash,
          bundleUrl: uploadData.publicUrl,
          isMandatory,
          description,
        }),
      });

      setProgress(90);

      if (!releaseRes.ok) {
        const data = await releaseRes.json();
        throw new Error(data.error || "Failed to create release");
      }

      const releaseData = await releaseRes.json();
      setProgress(100);
      setResult(
        `Release created successfully! App: ${releaseData.release.appId}, Bundle Version: ${releaseData.release.bundleVersion}`
      );

      setPlatform("android");
      setJsVersion("");
      setBundleVersion("");
      setDescription("");
      setIsMandatory(false);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Upload Bundle</h1>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600"
              >
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  JS Version
                </label>
                <input
                  type="number"
                  value={jsVersion}
                  onChange={(e) => setJsVersion(e.target.value)}
                  required
                  min={1}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Bundle Version
                </label>
                <input
                  type="number"
                  value={bundleVersion}
                  onChange={(e) => setBundleVersion(e.target.value)}
                  required
                  min={1}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600 placeholder-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What's in this release?"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600 placeholder-gray-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mandatory"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="mandatory" className="text-sm text-gray-300">
                Mandatory update (force users to update)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Bundle File
              </label>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-600 transition-colors">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".bundle,.jsbundle,.zip"
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <p className="text-gray-400 text-sm">
                    {file ? (
                      <span className="text-green-400">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                    ) : (
                      "Click to select a .bundle or .jsbundle file"
                    )}
                  </p>
                </label>
              </div>
            </div>
          </div>

          {uploading && (
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-green-900/50 border border-green-700 rounded-lg p-3">
              <p className="text-green-300 text-sm">{result}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {uploading ? "Uploading..." : "Upload & Create Release"}
          </button>
        </form>
      </div>
    </div>
  );
}
