import React from "react";
import { SplitFile } from "./splitProcessorType";
import SplitProcessorSummaryUI from "./splitProcessorSummaryUI";

interface SplitProcessorSummaryProps {
  splitMessage: string;
  splitFiles: SplitFile[];
}

const SplitProcessorSummary: React.FC<SplitProcessorSummaryProps> = ({
  splitMessage,
  splitFiles,
}) => {
  return (
    <SplitProcessorSummaryUI
      splitMessage={splitMessage}
      splitFiles={splitFiles}
    />
  );
};

export default SplitProcessorSummary;
