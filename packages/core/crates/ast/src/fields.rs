use crate::PayloadError;

/// Logical dynamic-payload accounting and validation, independent of tree shape.
/// The `markdown_definitions::payload` and `node` attributes derive this trait
/// from the fields themselves so new fields cannot escape accounting.
pub trait PayloadFields {
    /// Count string contents, populated collection slots, and boxed values,
    /// recursively including their dynamic fields. Spare collection capacity
    /// and allocation overhead do not contribute to this logical payload budget.
    fn dynamic_payload_bytes(&self) -> usize;
    fn validate_fields(&self) -> Result<(), PayloadError> {
        Ok(())
    }
}

macro_rules! scalars {
    ($($ty:ty),+ $(,)?) => { $(impl PayloadFields for $ty {
        fn dynamic_payload_bytes(&self) -> usize { 0 }
    })+ };
}
scalars!(
    (),
    bool,
    char,
    u8,
    u16,
    u32,
    u64,
    u128,
    usize,
    i8,
    i16,
    i32,
    i64,
    i128,
    isize
);

macro_rules! floats {
    ($($ty:ty),+ $(,)?) => { $(impl PayloadFields for $ty {
        fn dynamic_payload_bytes(&self) -> usize { 0 }
        fn validate_fields(&self) -> Result<(), PayloadError> {
            if self.is_finite() {
                Ok(())
            } else {
                Err(PayloadError::new("finite floating-point value").actual(self.to_string()))
            }
        }
    })+ };
}
floats!(f32, f64);

/// The length used by a payload's schema constraint. String lengths count
/// Unicode scalar values; collection lengths count elements.
pub trait PayloadLength {
    fn payload_length(&self) -> usize;
}

impl PayloadLength for String {
    fn payload_length(&self) -> usize {
        self.chars().count()
    }
}
impl<T> PayloadLength for Vec<T> {
    fn payload_length(&self) -> usize {
        self.len()
    }
}
impl<T, const N: usize> PayloadLength for [T; N] {
    fn payload_length(&self) -> usize {
        N
    }
}

impl PayloadFields for String {
    fn dynamic_payload_bytes(&self) -> usize {
        self.len()
    }
}
impl<T: PayloadFields> PayloadFields for Option<T> {
    fn dynamic_payload_bytes(&self) -> usize {
        self.as_ref()
            .map_or(0, PayloadFields::dynamic_payload_bytes)
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        if let Some(value) = self {
            value.validate_fields()?;
        }
        Ok(())
    }
}
impl<T: PayloadFields> PayloadFields for Vec<T> {
    fn dynamic_payload_bytes(&self) -> usize {
        self.iter().fold(
            self.len().saturating_mul(std::mem::size_of::<T>()),
            |total, field| total.saturating_add(field.dynamic_payload_bytes()),
        )
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        for value in self {
            value.validate_fields()?;
        }
        Ok(())
    }
}
impl<T: PayloadFields, const N: usize> PayloadFields for [T; N] {
    fn dynamic_payload_bytes(&self) -> usize {
        self.iter().fold(0usize, |total, field| {
            total.saturating_add(field.dynamic_payload_bytes())
        })
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        for value in self {
            value.validate_fields()?;
        }
        Ok(())
    }
}
impl<T: PayloadFields> PayloadFields for Box<T> {
    fn dynamic_payload_bytes(&self) -> usize {
        std::mem::size_of::<T>().saturating_add((**self).dynamic_payload_bytes())
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        (**self).validate_fields()
    }
}
