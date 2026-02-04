// frontend/src/api/dataClean/sanityCheckSummaryUI.tsx

import React from "react";
import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
  Card,
  CardContent,
  Divider,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { SanityCheckSummaryDisplayProps } from "./sanityCheckType";

const SanityCheckSummaryDisplay: React.FC<SanityCheckSummaryDisplayProps> = ({
  handlePgSanityCheck,
  handleMongoSanityCheck,
  isDeleteEnabled,
  setIsDeleteEnabled,
  normalize,
  setNormalize,
  cutoffDate,
  setCutoffDate,
  clientCode,
  setClientCode,
  isLoadingPg,
  isLoadingMongo,
}) => {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Card sx={{ maxWidth: 800, margin: "0 auto", mt: 4, boxShadow: 3 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6" color="primary" fontWeight="bold">
              Data Sanity Check & Cleanup
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Step 1: SQL Check | Step 2: Mongo Check
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Configuration Controls */}
          <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
            <DatePicker
              label="Cutoff Date"
              value={cutoffDate}
              onChange={(newValue) => setCutoffDate(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                  helperText: "Filter data before this date",
                },
              }}
            />

            <TextField
              label="Client Code"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
              size="small"
              placeholder="e.g., 101"
              helperText="Optional: Run for specific client"
            />
          </Box>

          {/* Toggles */}
          <Box
            display="flex"
            gap={4}
            mb={4}
            p={2}
            bgcolor="#f8f9fa"
            borderRadius={1}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={normalize}
                  onChange={(e) => setNormalize(e.target.checked)}
                  color="info"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Normalize Keys
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Trim & Lowercase comparison
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={isDeleteEnabled}
                  onChange={(e) => setIsDeleteEnabled(e.target.checked)}
                  color="error"
                />
              }
              label={
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight="medium"
                    color={isDeleteEnabled ? "error" : "text.primary"}
                  >
                    Enable Deletion (Live Mode)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isDeleteEnabled
                      ? "Rows WILL be deleted"
                      : "Dry Run Only (Safe)"}
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Action Buttons */}
          <Box display="flex" gap={3} justifyContent="flex-end">
            <Button
              variant="contained"
              color={isDeleteEnabled ? "error" : "primary"}
              onClick={() => handlePgSanityCheck(!isDeleteEnabled)}
              disabled={isLoadingPg || isLoadingMongo}
              sx={{ minWidth: 180 }}
            >
              {isLoadingPg
                ? "Checking SQL..."
                : isDeleteEnabled
                ? "Run Live SQL Delete"
                : "Run SQL Dry Run"}
            </Button>

            <Button
              variant="contained"
              color={isDeleteEnabled ? "error" : "secondary"}
              onClick={() => handleMongoSanityCheck(!isDeleteEnabled)}
              disabled={isLoadingPg || isLoadingMongo}
              sx={{ minWidth: 180 }}
            >
              {isLoadingMongo
                ? "Checking Mongo..."
                : isDeleteEnabled
                ? "Run Live Mongo Delete"
                : "Run Mongo Dry Run"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

export default SanityCheckSummaryDisplay;
