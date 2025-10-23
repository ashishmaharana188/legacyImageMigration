import React from "react";
import { styled, Theme, CSSObject } from "@mui/material/styles";
import MuiDrawer from "@mui/material/Drawer";
import { List, Divider, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StorageIcon from "@mui/icons-material/Storage";
import BugReportIcon from "@mui/icons-material/BugReport";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SidebarItem from "./SidebarItem";
import { Link } from "@tanstack/react-router";

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

interface MiniDrawerProps {
  open: boolean;
  handleDrawerClose: () => void;
  handleDrawerOpen: () => void;
  onSelectTask: (task: string) => void; // This can be removed if not used elsewhere
}

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  "& .MuiDrawer-paper": {
    backgroundColor: "#212427",
    color: "#EDECEB", // Adding white text for better contrast
  },
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": {
      ...openedMixin(theme),
      backgroundColor: "#212427",
      color: "#EDECEB",
    },
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": {
      ...closedMixin(theme),
      backgroundColor: "#212427",
      color: "#EDECEB",
    },
  }),
}));

const Sidebar: React.FC<MiniDrawerProps> = ({
  open,
  handleDrawerClose,
  handleDrawerOpen,
  onSelectTask,
}) => {
  return (
    <Drawer
      variant="permanent"
      open={open}
      PaperProps={{ sx: { backgroundColor: "whitesmoke" } }}
    >
      <DrawerHeader>
        <IconButton
          onClick={open ? handleDrawerClose : handleDrawerOpen}
          sx={{ color: "#EDECEB" }}
        >
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        <Link to="/upload-processor" onClick={() => onSelectTask("upload-processor")}>
          <SidebarItem
            icon={<UploadFileIcon />}
            text="Upload and Script"
            isSidebarOpen={open}
          />
        </Link>
        <Link to="/sql-mongo" onClick={() => onSelectTask("sql-mongo")}>
          <SidebarItem
            icon={<StorageIcon />}
            text="SQL and Mongo Calls"
            isSidebarOpen={open}
          />
        </Link>
        <Link to="/s3-browser" onClick={() => onSelectTask("s3-browser")}>
          <SidebarItem
            icon={<CloudUploadIcon />}
            text="S3 Browser"
            isSidebarOpen={open}
          />
        </Link>
        <Link to="/sanity-check" onClick={() => onSelectTask("sanity-check")}>
          <SidebarItem
            icon={<BugReportIcon />}
            text="Sanity Checks"
            isSidebarOpen={open}
          />
        </Link>
      </List>
    </Drawer>
  );
};

export default Sidebar;
