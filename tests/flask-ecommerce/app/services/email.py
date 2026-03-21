class EmailService:
    def send(self, to: str, subject: str, body: str = "") -> None:
        """Sends a transactional email via SMTP."""
        pass

    def send_order_confirmation(self, order_id: str, email: str) -> None:
        self.send(email, f"Order {order_id} confirmed")

    def send_password_reset(self, email: str, token: str) -> None:
        self.send(email, "Reset your password", f"Token: {token}")
