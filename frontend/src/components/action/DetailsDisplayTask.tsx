import React, { useState, useCallback } from 'react';
import axios from 'axios';
import DetailsDisplayUI from '../ui/DetailsDisplayUI';

interface DetailsDisplayTaskProps {
    log: any;
    logKey: string;
}

const DetailsDisplayTask: React.FC<DetailsDisplayTaskProps> = ({ log, logKey }) => {
    const [parsedBadRows, setParsedBadRows] = useState<any[] | null>([]);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const parseCsvContent = (csvString: string) => {
        const lines = csvString.trim().split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            return row;
        });
        return data;
    };

    const toggleBadRowsDisplay = useCallback(async (filePath: string, logId: string) => {
        if (expandedLogId === logId) {
            setParsedBadRows(null);
            setExpandedLogId(null);
        } else {
            try {
                const res = await axios.get(`http://localhost:3000/download-generated-file/${filePath}`);
                setParsedBadRows(parseCsvContent(res.data));
                setExpandedLogId(logId);
            } catch (error) {
                console.error("Failed to fetch bad rows content:", error);
                setParsedBadRows(null);
                setExpandedLogId(logId);
            }
        }
    }, [expandedLogId]);

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
