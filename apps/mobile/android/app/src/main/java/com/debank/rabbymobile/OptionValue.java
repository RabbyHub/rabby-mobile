package com.debank.rabbymobile;

public class OptionValue {
    public enum JSType { BOOLEAN, STRING, NUMBER, NIL }

    public final JSType jstype;
    public final Boolean boolVal;
    public final String stringVal;
    public final Double numberVal;

    private OptionValue(JSType type, Boolean bool, String str, Double num) {
        this.jstype = type;
        this.boolVal = bool;
        this.stringVal = str;
        this.numberVal = num;
    }

    public static OptionValue nil() {
        return new OptionValue(JSType.NIL, null, null, null);
    }

    public static OptionValue ofBoolean(boolean value) {
        return new OptionValue(JSType.BOOLEAN, value, null, null);
    }

    public static OptionValue ofString(String value) {
        return new OptionValue(JSType.STRING, null, value, null);
    }

    public static OptionValue ofNumber(double value) {
        return new OptionValue(JSType.NUMBER, null, null, value);
    }
}
