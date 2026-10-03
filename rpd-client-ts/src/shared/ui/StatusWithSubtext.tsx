import { Box, Button, Typography } from "@mui/material";

export type StatusWithSubtextProps = {
  label: string;
  subtext?: string | null;
  onClick?: () => void;
  ariaLabel?: string;
  underline?: boolean;
};

export function StatusWithSubtext({
  label,
  subtext,
  onClick,
  ariaLabel,
  underline = false,
}: StatusWithSubtextProps) {
  const content = (
    <Box component="span" sx={{ display: "block", minWidth: 0 }}>
      <Box
        component="span"
        sx={{
          display: "block",
          textDecoration: underline ? "underline" : undefined,
        }}
      >
        {label}
      </Box>
      {subtext ? (
        <Typography
          component="span"
          sx={(theme) => ({
            display: "block",
            color: "grey.600",
            fontSize: theme.typography.pxToRem(12),
          })}
        >
          {subtext}
        </Typography>
      ) : null}
    </Box>
  );
  const sx = {
    minWidth: 0,
    maxWidth: "100%",
    px: 0.625,
    py: 0.5,
    textAlign: "left",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    textTransform: "none",
    justifyContent: "flex-start",
  } as const;

  return onClick ? (
    <Button
      size="small"
      variant="text"
      color="primary"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      sx={{
        ...sx,
        "&.Mui-focusVisible": {
          outline: "2px solid",
          outlineColor: "primary.main",
        },
      }}
    >
      {content}
    </Button>
  ) : (
    <Box
      sx={(theme) => ({
        ...theme.typography.button,
        ...sx,
        color: "primary.main",
        fontSize: theme.typography.pxToRem(13),
      })}
    >
      {content}
    </Box>
  );
}
