import React from 'react';
import DetailsDisplayUI from '../ui/DetailsDisplayUI';
import { useBadRowsDisplay } from '../../api/uploadProcessor/uploadProcessorHook';

interface DetailsDisplayTaskProps {
    log: any;
    logKey: string;
}

const DetailsDisplayTask: React.FC<DetailsDisplayTaskProps> = ({ log, logKey }) => {
    const { parsedBadRows, expandedLogId, toggleBadRowsDisplay } = useBadRowsDisplay({ logKey });

    return (
        <DetailsDisplayUI
            log={log}
            logKey={logKey}
            expandedLogId={expandedLogId}
            parsedBadRows={parsedBadRows}
            toggleBadRowsDisplay={toggleBadRowsDisplay}
        />
    );
};

export default DetailsDisplayTask;
