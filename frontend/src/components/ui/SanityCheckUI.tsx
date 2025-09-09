import React from "react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Paper,
} from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

interface SanityCheckUIProps {
  handleSanityCheck: (dryRun: boolean) => Promise<void>;
  isDeleteEnabled: boolean;
  setIsDeleteEnabled: (value: boolean) => void;
  normalize: boolean;
  setNormalize: (value: boolean) => void;
  cutoffDate: dayjs.Dayjs | null;
  setCutoffDate: (value: dayjs.Dayjs | null) => void;
  isLoading: boolean;
}

const SanityCheckUI: React.FC<SanityCheckUIProps> = ({
  handleSanityCheck,
  isDeleteEnabled,
  setIsDeleteEnabled,
  normalize,
  setNormalize,
  cutoffDate,
  setCutoffDate,
  isLoading,
}) => {
  return (
    <Paper elevation={3} sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Sanity Check for Duplicates
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Cutoff Date"
            value={cutoffDate}
            onChange={(newValue) => setCutoffDate(newValue)}
            disabled={isLoading}
            slotProps={{ textField: { size: "small" } }}
          />
        </LocalizationProvider>
        <FormControlLabel
          control={
            <Checkbox
              checked={normalize}
              onChange={(e) => setNormalize(e.target.checked)}
              disabled={isLoading}
            />
          }
          label="Normalize (trim and lowercase) keys for comparison"
        />
        <Button
          onClick={() => handleSanityCheck(true)}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? "Checking..." : "Find Duplicate Rows (Dry Run)"}
        </Button>
        <FormControlLabel
          control={
            <Switch
              checked={isDeleteEnabled}
              onChange={(e) => setIsDeleteEnabled(e.target.checked)}
              color="warning"
              disabled={isLoading}
            />
          }
          label="Enable Deletion Mode"
        />
        {isDeleteEnabled && (
          <Button
            onClick={() => handleSanityCheck(false)}
            variant="contained"
            color="error"
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Found Duplicates"}
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default SanityCheckUI;
