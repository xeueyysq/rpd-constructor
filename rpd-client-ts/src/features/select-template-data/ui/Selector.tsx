import { Box, AutocompleteChangeReason, AutocompleteChangeDetails, Autocomplete, TextField } from "@mui/material";
import React, { useState, useEffect } from "react";
import { OptionType } from "../model/SelectorTypes.ts";

interface CustomSelector {
  title: string;
  placeholder: string;
  value: OptionType | undefined;
  onChange: (
    event: React.SyntheticEvent<Element, Event>,
    value: OptionType | null,
    reason: AutocompleteChangeReason,
    details?: AutocompleteChangeDetails<OptionType>
  ) => void;
  options: OptionType[];
  "data-cy"?: string;
}

export const CustomSelector: React.FC<CustomSelector> = ({ title, placeholder, value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(!value);

  useEffect(() => {
    setIsOpen(!value);
  }, [value]);

  const handleChange = (
    event: React.SyntheticEvent<Element, Event>,
    newValue: OptionType | null,
    reason: AutocompleteChangeReason,
    details?: AutocompleteChangeDetails<OptionType>
  ) => {
    onChange(event, newValue, reason, details);
    if (newValue) {
      setIsOpen(false);
    }
  };

  return (
    <Box sx={{ my: 1 }}>
      <Box sx={{ fontSize: "15px", fontWeight: "600", py: 1 }}>{title}</Box>
      <Autocomplete
        value={value}
        onChange={handleChange}
        options={options}
        data-cy="select-option"
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        renderInput={(params) => <TextField {...params} label={placeholder} size="small" />}
      />
    </Box>
  );
};
