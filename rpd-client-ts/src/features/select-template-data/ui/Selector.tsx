import {
  Box,
  AutocompleteChangeReason,
  AutocompleteChangeDetails,
  Autocomplete,
  TextField,
} from "@mui/material";
import React from "react";
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

export const CustomSelector: React.FC<CustomSelector> = ({
  title,
  placeholder,
  value,
  onChange,
  options,
}) => {
  return (
    <Box sx={{ my: 1 }}>
      <Box sx={{ fontSize: "20px", fontWeight: "600", py: 1 }}>{title}</Box>
      <Autocomplete
        value={value}
        onChange={onChange}
        options={options}
        data-cy="select-option"
        renderInput={(params) => (
          <TextField {...params} label={placeholder} size="small" />
        )}
      />
    </Box>
  );
};
