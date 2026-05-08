import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";
import { vi } from "vitest";

describe("LoginForm", () => {
  it("renders form title", () => {
    render(<LoginForm onLogin={async () => {}} />);
    expect(screen.getByText("Kanban")).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
  });

  it("renders username input", () => {
    render(<LoginForm onLogin={async () => {}} />);
    const input = screen.getByLabelText("Username");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders password input", () => {
    render(<LoginForm onLogin={async () => {}} />);
    const input = screen.getByLabelText("Password");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("renders sign in submit button in login mode", () => {
    const { container } = render(<LoginForm onLogin={async () => {}} />);
    const submitBtn = container.querySelector('button[type="submit"]');
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveTextContent(/sign in/i);
  });

  it("calls onLogin with credentials on form submit", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<LoginForm onLogin={mockLogin} />);

    await user.type(screen.getByLabelText("Username"), "testuser");
    await user.type(screen.getByLabelText("Password"), "testpass");
    await user.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "testpass");
    });
  });

  it("shows loading state on submit button", () => {
    const { container } = render(<LoginForm onLogin={async () => {}} isLoading={true} />);
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/signing in/i);
  });

  it("displays error message", () => {
    render(<LoginForm onLogin={async () => {}} error="Invalid credentials" />);
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("displays demo credentials help in login mode", () => {
    render(<LoginForm onLogin={async () => {}} />);
    expect(screen.getByText("Demo credentials:")).toBeInTheDocument();
  });

  it("trims whitespace from inputs", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<LoginForm onLogin={mockLogin} />);

    await user.type(screen.getByLabelText("Username"), "  testuser  ");
    await user.type(screen.getByLabelText("Password"), "  testpass  ");
    await user.click(container.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "testpass");
    });
  });

  it("does not call onLogin with empty inputs", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();
    const { container } = render(<LoginForm onLogin={mockLogin} />);

    await user.click(container.querySelector('button[type="submit"]')!);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("switches to register mode", async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={async () => {}} onRegister={async () => {}} />);

    await user.click(screen.getByRole("button", { name: /register/i }));
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("calls onRegister when in register mode", async () => {
    const user = userEvent.setup();
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={async () => {}} onRegister={mockRegister} />);

    await user.click(screen.getByRole("button", { name: /register/i }));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("newuser", "password123");
    });
  });

  it("shows validation error when passwords do not match", async () => {
    const user = userEvent.setup();
    const mockRegister = vi.fn();
    render(<LoginForm onLogin={async () => {}} onRegister={mockRegister} />);

    await user.click(screen.getByRole("button", { name: /register/i }));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "different");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
