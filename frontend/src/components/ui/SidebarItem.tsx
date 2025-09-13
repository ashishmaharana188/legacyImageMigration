import React from "react";
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

interface SidebarItemProps {
  icon: React.ReactElement;
  text: string;
  isSidebarOpen: boolean;
  onClick: () => void; // New prop
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  text,
  isSidebarOpen,
  onClick,
}) => {
  return (
    <ListItem disablePadding sx={{ display: "block" }}>
      <ListItemButton
        sx={{
          minHeight: 48,
          justifyContent: isSidebarOpen ? "initial" : "center",
          px: 2.5,
        }}
        onClick={onClick}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: isSidebarOpen ? 3 : "auto",
            justifyContent: "center",
            color: "#EDECEB", // Primary accent color
          }}
        >
          {icon}
        </ListItemIcon>
        {isSidebarOpen && (
          <ListItemText
            primary={text}
            sx={{ opacity: isSidebarOpen ? 1 : 0 }}
          />
        )}
      </ListItemButton>
    </ListItem>
  );
};

export default SidebarItem;
