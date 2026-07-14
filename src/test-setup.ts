import '@testing-library/jest-dom'
import { config } from 'dotenv'
config({ path: '.env.local' })

if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.show = function () { this.open = true }
  HTMLDialogElement.prototype.close = function (v?: string) {
    this.open = false; if (v !== undefined) this.returnValue = v
    this.dispatchEvent(new Event('close'))
  }
}
