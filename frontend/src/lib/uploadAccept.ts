// Accepted upload types. Photos AND engineering/CAD files — without an explicit
// accept list, mobile pickers default to camera/photo-only and hide STEP files.
const CAD_EXT = [
  ".step", ".stp", ".stl", ".iges", ".igs", ".3mf", ".obj", ".f3d",
  ".sldprt", ".sldasm", ".ipt", ".iam", ".prt", ".catpart", ".catproduct",
  ".x_t", ".x_b", ".dwg", ".dxf", ".3dm", ".gltf", ".glb",
];
const DOC_EXT = [".pdf", ".csv", ".xlsx", ".docx", ".txt", ".zip"];

// String for an <input type="file" accept="..."> covering images, video, CAD,
// and common docs.
export const UPLOAD_ACCEPT = ["image/*", "video/*", ...CAD_EXT, ...DOC_EXT].join(",");
