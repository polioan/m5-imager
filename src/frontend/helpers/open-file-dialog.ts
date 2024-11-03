export interface OpenFileDialogOptions {
  multiple?: boolean | undefined
  accept?: string | undefined
}

export function openFileDialog(
  options: OpenFileDialogOptions | undefined = { multiple: false }
) {
  return new Promise<File[]>(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = options.multiple ?? false
    if (options.accept) {
      input.accept = options.accept
    }

    input.addEventListener(
      'change',
      () => {
        resolve([...(input.files ?? [])])
      },
      { once: true }
    )

    input.click()
  })
}
