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
  onSelectTask: (task: string) => void; // New prop
}

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": closedMixin(theme),
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
        <IconButton onClick={open ? handleDrawerClose : handleDrawerOpen}>
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        <SidebarItem
          icon={<UploadFileIcon />}
          text="Upload and Script"
          isSidebarOpen={open}
          onClick={() => onSelectTask("uploadAndScript")}
        ></SidebarItem>
        <SidebarItem
          icon={<StorageIcon />}
          text="SQL and Mongo Calls"
          isSidebarOpen={open}
          onClick={() => onSelectTask("sqlAndMongo")}
        ></SidebarItem>
        <SidebarItem
          icon={<CloudUploadIcon />}
          text="S3 Browser"
          isSidebarOpen={open}
          onClick={() => onSelectTask("s3Browser")}
        ></SidebarItem>
        <SidebarItem
          icon={<BugReportIcon />}
          text="Sanity Checks"
          isSidebarOpen={open}
          onClick={() => onSelectTask("sanityCheck")}
        ></SidebarItem>
      </List>
    </Drawer>
  );
};

export default Sidebar;
