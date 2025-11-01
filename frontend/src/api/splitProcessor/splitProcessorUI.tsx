import React from "react";
import { splitProcessorUIProps } from "./splitProcessorType";


const SplitProcessorUI: React.FC<splitProcessorUIProps> = ({
    loading,
    handleSplitFiles,
    handleSplitFilesWithMuPDF,
    selectedFile,
    setSelectedFile,
}) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    return(      <div className="border border-gray-300 rounded-lg p-4 flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-lg text-black mb-3">
                PDF Splitting
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Split the uploaded PDF into individual pages using different
                methods.
              </p>
            </div>
            <div className="mb-4">
                <input type="file" onChange={handleFileChange} className="form-input" />
                {selectedFile && <p className="text-sm text-gray-600 mt-2">Selected file: {selectedFile.name}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSplitFiles}
                disabled={loading || !selectedFile}
                className="btn w-full"
              >
                {loading ? "Splitting..." : "Split PDF"}
              </button>
              <button
                onClick={handleSplitFilesWithMuPDF}
                disabled={loading || !selectedFile}
                className="btn w-full"
              >
                {loading ? "Splitting..." : "Split with MuPDF"}
              </button>
            </div>
          </div>
    )
}


export default SplitProcessorUI;
