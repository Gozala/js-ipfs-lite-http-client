/**
 * @param {BlobPart} content
 * @returns {string|null}
 */
export const getFileName = (content) => {
  if (content instanceof File) {
    const name =
      // @ts-ignore - There is no File in node, but it's will be undefined
      content.filepath || content.webkitRelativePath || content.name || null
    return name
  } else {
    return null
  }
}
